'use client';

// Sınıflarım: class lists kept once and picked in the upload wizard.

import { useCallback, useEffect, useState } from 'react';
import type { ClassView } from '@/components/console/api';
import { useToast } from '@/components/Toast';
import { useTeacher } from './context';
import { IconClasses, IconEdit, IconPlus, IconTrash } from './icons';
import { Empty, PageHeader, dateTr } from './ui';

type Editing = { id: string | null; name: string; students: string };

export default function ClassesPage() {
  const { api } = useTeacher();
  const toast = useToast();
  const [list, setList] = useState<ClassView[] | null>(null);
  const [edit, setEdit] = useState<Editing | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.classes();
    if (r.ok) setList(r.data);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit) return;
    setBusy(true);
    const r = edit.id ? await api.updateClass(edit.id, { name: edit.name, students: edit.students }) : await api.createClass(edit.name, edit.students);
    setBusy(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(`${r.data.name} kaydedildi: ${r.data.students.length} öğrenci`, 'success');
    setEdit(null);
    load();
  }

  async function remove(c: ClassView) {
    const r = await api.deleteClass(c.id);
    setConfirm(null);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(`${c.name} silindi`, 'success');
    load();
  }

  const editor = edit && (
    <section className="app-card app-editor">
      <h2>{edit.id ? 'Sınıfı düzenleyin' : 'Yeni sınıf'}</h2>
      <div className="field">
        <label htmlFor="class-name">Sınıfın adı</label>
        <input id="class-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="9-A" maxLength={60} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="class-students">Öğrenciler <span className="app-label-note">her satıra bir öğrenci</span></label>
        <textarea id="class-students" aria-describedby="class-students-hint" className="console-text tall" value={edit.students} onChange={(e) => setEdit({ ...edit, students: e.target.value })}
          placeholder={'Elif Yıldız\nMert Kaya\nZeynep Arslan'} />
        <span id="class-students-hint" className="field-hint">e-Okul&apos;dan ya da bir tablodan kopyalayıp yapıştırabilirsiniz; numara sütunları ve tekrarlar atılır. {edit.students.split('\n').filter((l) => l.trim()).length} satır.</span>
      </div>
      <div className="app-row-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !edit.name.trim()}>Kaydedin</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Vazgeçin</button>
      </div>
    </section>
  );

  return (
    <>
      <PageHeader
        title="Sınıflarım"
        sub="Sınıf listelerini bir kez kaydedin; sınav yüklerken listeden seçin. İsimler kâğıtlarla bu listeye göre eşleştirilir."
        actions={!edit && <button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, name: '', students: '' })}><IconPlus size={17} /> Yeni sınıf</button>}
      />
      {editor}
      {list === null ? <div className="app-skeleton" /> : list.length === 0 && !edit ? (
        <section className="app-card app-flush">
          <Empty icon={<IconClasses size={28} />} title="Henüz kayıtlı sınıfınız yok"
            action={<button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, name: '', students: '' })}>İlk sınıfınızı ekleyin</button>}>
            Bir sınıfı kaydettiğinizde, her sınavda listeyi yeniden yapıştırmanız gerekmez.
          </Empty>
        </section>
      ) : list.length === 0 ? null : (
        <section className="app-card app-flush">
          <ul className="app-classes">
            {list.map((c) => (
              <li key={c.id} className="app-class">
                <div className="app-class-main">
                  <h3>{c.name}</h3>
                  <p className="app-class-names">{c.students.slice(0, 6).join(', ')}{c.students.length > 6 ? ` ve ${c.students.length - 6} kişi daha` : ''}</p>
                </div>
                <div className="app-class-count"><strong>{c.students.length}</strong> öğrenci</div>
                <div className="app-class-date">Güncellendi: {dateTr(c.updatedAt)}</div>
                <div className="app-class-actions">
                  {confirm === c.id ? (
                    <span className="app-row-actions">
                      <span className="small">Silinsin mi?</span>
                      <button type="button" className="btn btn-sm app-danger" onClick={() => remove(c)}>Evet, silin</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>Hayır</button>
                    </span>
                  ) : (
                    <span className="app-row-actions">
                      <button type="button" className="app-icon-btn" aria-label={`${c.name} düzenle`} title="Düzenleyin"
                        onClick={() => { setEdit({ id: c.id, name: c.name, students: c.students.join('\n') }); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>
                        <IconEdit />
                      </button>
                      <button type="button" className="app-icon-btn" aria-label={`${c.name} sil`} title="Silin" onClick={() => setConfirm(c.id)}><IconTrash /></button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
