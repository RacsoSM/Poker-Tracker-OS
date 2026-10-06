import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { addChunk, addHand, addTemplates, DuplicateHandError, findHandByHandId, findSimilarChunk, loadTemplates, type ImageInput } from '../../db/repo';
import type { Hand, HandValues } from '../../domain/types';
import { decodeImageFile } from '../../import/decodeImage';
import { templatesToLearn } from '../../import/learn';
import { analyzeFile, importedHandDraft, type Analysis, type IncomingFile } from '../../import/pipeline';
import { manualHandId } from '../../import/syntheticId';
import { takeSharedFiles } from '../../import/shared';
import { getBrowserEngine } from '../../ocr/loader';
import { emptyHandDraft } from '../../parsers/hand';
import { emptySummaryDraft } from '../../parsers/summary';
import { HandForm } from '../components/HandForm';
import { handStateFromDraft } from '../components/handValidation';
import { SummaryForm, type SummaryValues } from '../components/SummaryForm';
import { useObjectUrl, useSettings } from '../hooks';

type State =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; analysis: Analysis; duplicate?: Hand };

async function readFiles(list: File[]): Promise<IncomingFile[]> {
  return Promise.all(
    list.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type || 'image/png', lastModified: f.lastModified || Date.now(), name: f.name })),
  );
}

export function UploadPage() {
  const db = useDb();
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [queue, setQueue] = useState<IncomingFile[]>([]);
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState<'session' | 'hand' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: 'idle' });
  const current = queue[index];
  const previewUrl = useObjectUrl(current?.bytes, current?.mime);
  const heroName = settings?.heroName;

  useEffect(() => {
    if (params.get('shared') !== '1') return;
    void takeSharedFiles().then((files) => {
      if (files.length) {
        setQueue(files);
        setIndex(0);
      }
    });
  }, [params]);

  useEffect(() => {
    if (!current || !heroName) return;
    let cancelled = false;
    setState({ status: 'analyzing' });
    (async () => {
      try {
        const engine = await getBrowserEngine();
        const templates = await loadTemplates(db);
        const analysis = await analyzeFile(current, { engine, decode: decodeImageFile, templates, heroName });
        const duplicate = analysis.kind === 'hand' && analysis.draft.handId ? await findHandByHandId(db, analysis.draft.handId) : undefined;
        if (!cancelled) setState({ status: 'ready', analysis, duplicate });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, heroName, db]);

  function next() {
    if (index + 1 < queue.length) setIndex(index + 1);
    else {
      setQueue([]);
      setIndex(0);
      setState({ status: 'idle' });
      navigate('/dias');
    }
  }

  function pick(list: FileList | null) {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(f.name));
    setDropNotice(list?.length && !images.length ? 'Lo que soltaste no tiene imágenes (png, jpg, webp o heic).' : null);
    if (!images.length) return;
    void readFiles(images).then((f) => {
      setQueue(f);
      setIndex(0);
    });
  }

  /** Devuelve false si el usuario decidió no guardar un tramo que parece repetido. */
  async function saveChunk(v: SummaryValues, image?: ImageInput): Promise<boolean> {
    const similar = await findSimilarChunk(db, v, settings!.dayCutoffHour);
    if (similar && !window.confirm('Ya hay un tramo con el mismo resultado, manos y duración ese día. ¿Guardarlo de todas formas?')) return false;
    await addChunk(db, { ...v, stakes: settings!.stakes }, image);
    return true;
  }

  if (!settings) return <p className="muted page">Cargando…</p>;

  if (manual === 'hand' && !current) {
    return (
      <section className="page">
        <h1>Agregar mano manualmente</h1>
        <HandForm
          initial={handStateFromDraft({ ...emptyHandDraft(), handId: manualHandId(), playedAt: Date.now(), uncertain: [] })}
          onSave={async (v) => {
            try {
              const saved = await addHand(db, v);
              setManual(null);
              navigate(`/manos/${saved.id}`);
            } catch (e) {
              if (e instanceof DuplicateHandError) window.alert('Ya existe otra mano con ese ID.');
              else throw e;
            }
          }}
          onCancel={() => setManual(null)}
          cancelLabel="Cancelar"
        />
      </section>
    );
  }

  if (manual === 'session' && !current) {
    return (
      <section className="page">
        <h1>Agregar sesión manualmente</h1>
        <SummaryForm
          initial={{ startedAt: Date.now(), resultCny: null, hands: null, durationSec: null }}
          onSave={async (v) => {
            if (!(await saveChunk(v))) return;
            setManual(null);
            navigate('/dias');
          }}
          onCancel={() => setManual(null)}
          cancelLabel="Cancelar"
        />
      </section>
    );
  }

  if (!current) {
    return (
      <section className="page">
        <h1>Subir capturas</h1>
        <p className="muted">Elige capturas de "My stats" o manos descargadas de WPT. Puedes elegir varias a la vez.</p>
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
        >
          Suelta aquí las capturas
        </div>
        {dropNotice && <p className="warning" role="alert">{dropNotice}</p>}
        <label className="btn primary">
          Elegir de la galería
          <input type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        </label>{' '}
        <label className="btn">
          Elegir de Drive / archivos
          <input type="file" accept="*/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        </label>
        <h2>¿Sin captura?</h2>
        <p className="muted">Escribe a mano el resultado, las manos y la duración de una sesión, o los datos de una mano.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setManual('session')}>Agregar sesión manualmente</button>
          <button type="button" className="btn" onClick={() => setManual('hand')}>Agregar mano manualmente</button>
        </div>
      </section>
    );
  }

  const image = state.status === 'ready' ? state.analysis.image : null;
  const imageInput = () => ({ bytes: current.bytes, mime: current.mime, width: image!.width, height: image!.height });

  async function saveSummary(v: SummaryValues) {
    if (await saveChunk(v, imageInput())) next();
  }

  async function saveHand(v: HandValues) {
    if (state.status !== 'ready' || state.analysis.kind !== 'hand') return;
    try {
      await addHand(db, v, imageInput());
    } catch (e) {
      if (e instanceof DuplicateHandError) {
        window.alert('Esta mano ya está guardada.');
        return;
      }
      throw e;
    }
    await addTemplates(db, templatesToLearn(state.analysis.draft, v));
    next();
  }

  return (
    <section className="page">
      <h1>Subir capturas</h1>
      <p className="muted">Captura {index + 1} de {queue.length}</p>
      {previewUrl && <img className="shot" src={previewUrl} alt="Captura a confirmar" />}
      {state.status === 'analyzing' && <p role="status">Leyendo captura…</p>}
      {state.status === 'error' && (
        <>
          <p className="warning">{state.message}</p>
          <button type="button" className="btn" onClick={next}>Saltar</button>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'unknown' && (
        <>
          <p className="warning">No reconocí esta captura. ¿Qué es?</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setState({ status: 'ready', analysis: { kind: 'summary', draft: emptySummaryDraft(), image: state.analysis.image } })}>Es un resumen (My stats)</button>
            <button type="button" className="btn" onClick={() => setState({ status: 'ready', analysis: { kind: 'hand', draft: importedHandDraft(emptyHandDraft(), current, Date.now()), image: state.analysis.image } })}>Es una mano</button>
            <button type="button" className="btn" onClick={next}>Descartar</button>
          </div>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'summary' && (
        <SummaryForm
          key={index}
          initial={{
            startedAt: current.lastModified,
            resultCny: state.analysis.draft.resultCny,
            hands: state.analysis.draft.hands,
            durationSec: state.analysis.draft.durationSec,
          }}
          uncertain={state.analysis.draft.uncertain}
          onSave={saveSummary}
          onCancel={next}
        />
      )}
      {state.status === 'ready' && state.analysis.kind === 'hand' && state.duplicate && (
        <>
          <p className="warning">Esta mano ya está guardada.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => navigate(`/manos/${state.duplicate!.id}`)}>Ver mano guardada</button>
            <button type="button" className="btn" onClick={next}>Siguiente</button>
          </div>
        </>
      )}
      {state.status === 'ready' && state.analysis.kind === 'hand' && !state.duplicate && (
        <HandForm key={index} initial={handStateFromDraft(state.analysis.draft)} uncertain={state.analysis.draft.uncertain} onSave={saveHand} onCancel={next} />
      )}
    </section>
  );
}
