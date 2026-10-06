// Small pieces the console's cards share.

export type Note = { ok: boolean; text: string } | null;

export function NoteBanner({ note }: { note: Note }) {
  return note ? <p className={`console-banner ${note.ok ? 'ok' : 'err'}`}>{note.text}</p> : null;
}

export function NoteInline({ note }: { note: Note }) {
  return note ? <span className={`small ${note.ok ? 'muted' : 'console-err'}`}>{note.text}</span> : null;
}

export function RosterEditor({ value, onChange, onSave, saveLabel, note = null }: {
  value: string; onChange: (v: string) => void; onSave: () => void; saveLabel: string; note?: Note;
}) {
  return (
    <>
      <textarea className="console-text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={'Elif Yılmaz\nMert Kaya'} />
      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSave}>{saveLabel}</button>
        <NoteInline note={note} />
      </div>
    </>
  );
}

// optik gives the pages back with the report, klasik when grading ends
export function FailedSheets({ failed, refunded }: { failed: { seq: number; reason: string }[]; refunded: boolean }) {
  if (!failed.length) return null;
  return (
    <>
      <h3 className="console-sub">Okunamayan kâğıtlar</h3>
      <ul className="small console-list">
        {failed.map((f) => <li key={f.seq}>Kâğıt {f.seq}: {f.reason} (hakkı iade {refunded ? 'edildi' : 'edilir'})</li>)}
      </ul>
    </>
  );
}
