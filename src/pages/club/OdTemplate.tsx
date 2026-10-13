import { useEffect, useRef, useState } from 'react';
import { Eye, FileText, FileUp, Info, RotateCcw, Save, X } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import { Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, PageLoader, Textarea, btnClass, useToast } from '../../components/ui';

interface Settings {
  name: string;
  od_template_url: string | null;
  od_body: string;
  od_top_mm: number;
  od_signatory_name: string | null;
  od_signatory_title: string | null;
  default_body: string;
  fields: string[];
}

function readPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return reject(new Error('Please choose a PDF file.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('PDF templates must be 5 MB or smaller.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, 'data:application/pdf;'));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function OdTemplatePage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Settings>('/api/club/od-template');
  const [template, setTemplate] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [topMm, setTopMm] = useState('55');
  const [signName, setSignName] = useState('');
  const [signTitle, setSignTitle] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!data) return;
    setTemplate(data.od_template_url);
    setBody(data.od_body);
    setTopMm(String(data.od_top_mm));
    setSignName(data.od_signatory_name ?? '');
    setSignTitle(data.od_signatory_title ?? '');
  }, [data]);

  if (loading || !data) return <PageLoader />;

  const insertField = (f: string) => {
    const el = bodyRef.current;
    const token = `{{${f}}}`;
    if (!el) return setBody(b => b + token);
    const { selectionStart: a, selectionEnd: b } = el;
    setBody(body.slice(0, a) + token + body.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };

  const save = async (thenPreview = false) => {
    setBusy(true);
    setErr(null);
    try {
      await api('/api/club/od-template', { method: 'PUT', body: { template, body, topMm: Number(topMm), signatoryName: signName, signatoryTitle: signTitle } });
      toast('OD template saved');
      setFileName(null);
      reload();
      if (thenPreview) window.open('/api/club/od-template/preview', '_blank');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <PageHeader title="OD template" subtitle="Students in confirmed teams download On-Duty letters printed on this template, once you issue them." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader icon={FileUp} title="Template PDF" subtitle="Your club or department letterhead, A4. Page 1 is used." />
            <div className="p-5">
              {template ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
                  <FileText className="size-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{fileName ?? 'Current template'}</p>
                    <p className="text-xs text-muted">{fileName ? 'Not saved yet' : 'In use for every OD letter'}</p>
                  </div>
                  {!fileName && (
                    <a href={template} target="_blank" rel="noreferrer" className={btnClass('ghost', 'sm')}>
                      View
                    </a>
                  )}
                  <Button size="sm" variant="ghost" icon={X} onClick={() => { setTemplate(null); setFileName(null); }} aria-label="Remove template" />
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line bg-canvas px-6 py-10 text-center transition-colors hover:border-ink/25 hover:bg-raised">
                  <FileUp className="size-6 text-muted" />
                  <span className="text-sm font-medium text-ink">Upload template PDF</span>
                  <span className="text-xs text-muted">PDF, up to 5 MB</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      try {
                        setTemplate(await readPdf(f));
                        setFileName(f.name);
                      } catch (error) {
                        setErr((error as Error).message);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={FileText} title="Letter text" subtitle="Written onto the template below your letterhead. Click a field to insert it." />
            <div className="grid gap-4 p-5">
              <div className="flex flex-wrap gap-1.5">
                {data.fields.map(f => (
                  <button key={f} type="button" onClick={() => insertField(f)} className="rounded-lg border border-line bg-raised px-2 py-1 font-mono text-xs text-ink hover:border-accent hover:text-accent">
                    {`{{${f}}}`}
                  </button>
                ))}
              </div>
              <Textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={18} className="font-mono text-[13px]" />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <Field label="Text starts (mm from top)" hint="Move it below your letterhead's header." className="w-56">
                  <Input type="number" min={20} max={200} value={topMm} onChange={e => setTopMm(e.target.value)} />
                </Field>
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setBody(data.default_body)}>
                  Reset to default text
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Signatory</p>
            <div className="mt-4 grid gap-4">
              <Field label="Name" required>
                <Input value={signName} onChange={e => setSignName(e.target.value)} placeholder="Dr. R. Senthil Kumar" />
              </Field>
              <Field label="Designation" required>
                <Input value={signTitle} onChange={e => setSignTitle(e.target.value)} placeholder="Faculty Coordinator" />
              </Field>
            </div>
          </Card>
          <ErrorNote>{err}</ErrorNote>
          <div className="grid gap-2">
            <Button variant="primary" icon={Save} loading={busy} onClick={() => save()}>
              Save template
            </Button>
            <Button icon={Eye} onClick={() => save(true)} disabled={busy}>
              Save & preview PDF
            </Button>
          </div>
          <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              <span className="font-semibold text-ink">Have a fillable PDF form instead?</span> Name its text fields exactly like the field chips (e.g. <span className="font-mono text-ink">name</span>, <span className="font-mono text-ink">register_number</span>) and we fill those fields instead of writing the letter text. Every OD also gets a verification QR in the bottom-right corner.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
