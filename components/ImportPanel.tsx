"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extractStatement, confirmImport, type ExtractRow } from "@/app/actions/transactions";
import { CATEGORIES } from "@/lib/dre";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";

type PreviewRow = ExtractRow & { tempId: string; include: boolean };

export default function ImportPanel({
  companyId,
  tipo,
  accounts,
  customCategories,
}: {
  companyId: string;
  tipo: "cartao" | "banco";
  accounts: string[];
  customCategories: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(accounts.length === 0);
  const [files, setFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [accountValue, setAccountValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allCategoryOptions = [
    ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    ...customCategories.map((name) => ({ key: name, label: name })),
  ];

  const totalSizeMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);

  // Redimensiona e recomprime a foto no navegador antes de enviar. A IA de
  // visão já reduz a imagem internamente pra ~2000px no lado maior, então
  // mandar a foto em resolução total da câmera só desperdiça banda — isso
  // que permite enviar várias fotos juntas sem estourar limite de tamanho.
  function compressImage(file: File, maxDim = 2000, quality = 0.82): Promise<File> {
    if (!file.type.startsWith("image/")) return Promise.resolve(file); // PDF passa direto
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
            resolve(new File([blob], newName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length === 0) return;
    setCompressing(true);
    try {
      const processed = await Promise.all(picked.map((f) => compressImage(f)));
      setFiles((prev) => [...prev, ...processed]);
    } finally {
      setCompressing(false);
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.delete("file");
    files.forEach((f) => formData.append("file", f));
    const account = String(formData.get("account") || "Conta sem nome").trim() || "Conta sem nome";
    setAccountValue(account);

    startTransition(async () => {
      const res = await extractStatement(companyId, tipo, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSkipped(res.skipped || 0);
      setPreviewRows(
        (res.rows || []).map((r, i) => ({
          ...r,
          tempId: `${i}-${r.date}-${r.amount}`,
          include: !r.isDuplicate,
        }))
      );
    });
  }

  function updateRow(tempId: string, patch: Partial<PreviewRow>) {
    setPreviewRows((rows) => (rows ? rows.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)) : rows));
  }

  function removeRow(tempId: string) {
    setPreviewRows((rows) => (rows ? rows.filter((r) => r.tempId !== tempId) : rows));
  }

  function handleConfirm() {
    if (!previewRows) return;
    const included = previewRows.filter((r) => r.include);
    if (included.length === 0) {
      setError("Marque pelo menos uma transação pra importar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmImport(
        companyId,
        tipo,
        accountValue,
        included.map((r) => ({ date: r.date, description: r.description, amount: r.amount, category: r.category }))
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success || null);
      setPreviewRows(null);
      setFiles([]);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleCancelPreview() {
    setPreviewRows(null);
    setError(null);
  }

  const includedCount = previewRows ? previewRows.filter((r) => r.include).length : 0;
  const duplicateCount = previewRows ? previewRows.filter((r) => r.isDuplicate).length : 0;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-bold w-full"
      >
        <Upload size={15} /> {open ? "Fechar importação" : "Importar extrato"}
      </button>

      {open && !previewRows && (
        <form ref={formRef} onSubmit={handleSubmit} className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              {tipo === "cartao" ? "Nome do cartão (ex: Nubank, Itaú Black)" : "Conta bancária (ex: Inter PJ, Bradesco PJ)"}
            </label>
            <input
              name="account"
              list="accounts-list"
              placeholder="Nome da conta"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <datalist id="accounts-list">
              {accounts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>

            <div className="h-3" />
            <label className="block text-xs font-semibold text-muted mb-1.5">Fotos ou PDF (pode enviar várias de uma vez — até 10-12 fotos numa importação)</label>
            <label className="flex items-center justify-center text-center text-sm text-muted border border-dashed border-border rounded-lg px-4 py-5 cursor-pointer hover:border-gold hover:text-foreground transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                multiple
                disabled={compressing}
                className="hidden"
                onChange={handleFilesPicked}
              />
              {compressing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="spin" /> Otimizando fotos...
                </span>
              ) : files.length > 0 ? (
                "Adicionar mais fotos"
              ) : (
                "Clique para enviar fotos ou um PDF"
              )}
            </label>

            {files.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${f.size}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs bg-background border border-border rounded-lg px-2.5 py-1.5"
                  >
                    <span className="truncate">{f.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-faint">{(f.size / (1024 * 1024)).toFixed(1)}MB</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-faint hover:text-red">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <p className={`text-xs mt-0.5 ${totalSizeMB > 20 ? "text-red" : "text-faint"}`}>
                  {files.length} foto(s) — {totalSizeMB.toFixed(1)}MB no total (já compactadas automaticamente)
                  {totalSizeMB > 20 ? " — passou do limite, remova alguma foto ou importe em duas partes." : ""}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Ou cole o texto do extrato</label>
            <textarea
              name="text"
              rows={5}
              placeholder={"12/05 PIX RECEBIDO ... 1.200,00\n13/05 TIKTOK ADS ... 450,00 D\n..."}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gold resize-y"
            />
            <button
              type="submit"
              disabled={pending || compressing}
              className="mt-2 bg-gold text-[#1a1305] font-bold text-sm rounded-lg py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              {pending ? "Processando..." : "Processar com IA"}
            </button>
          </div>

          <p className="sm:col-span-2 text-xs text-faint leading-relaxed">
            A IA lê o extrato e te mostra uma prévia antes de salvar — você revisa, corrige e só confirma depois.
          </p>

          {error && (
            <div className="sm:col-span-2 flex items-start gap-2 text-sm text-red bg-red-soft rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {success && (
            <div className="sm:col-span-2 flex items-start gap-2 text-sm text-green bg-green-soft rounded-lg px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> {success}
            </div>
          )}
        </form>
      )}

      {open && previewRows && (
        <div className="mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-xs text-muted">
              {previewRows.length} transação(ões) encontrada(s)
              {skipped > 0 ? ` — ${skipped} linha(s) ignorada(s)` : ""}
              {duplicateCount > 0 ? ` — ${duplicateCount} possível(eis) duplicado(s) já desmarcado(s)` : ""}
            </p>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="text-left text-faint border-b border-border">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Descrição</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2">Categoria</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr
                      key={r.tempId}
                      className={`border-b border-border ${r.isDuplicate ? "bg-red-soft" : ""} ${!r.include ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => updateRow(r.tempId, { include: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateRow(r.tempId, { date: e.target.value })}
                          className="bg-background border border-border rounded px-1.5 py-1 text-xs w-28"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.description}
                          onChange={(e) => updateRow(r.tempId, { description: e.target.value })}
                          className="bg-background border border-border rounded px-1.5 py-1 text-xs w-full min-w-[120px]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.amount}
                          onChange={(e) => updateRow(r.tempId, { amount: parseFloat(e.target.value) || 0 })}
                          className="bg-background border border-border rounded px-1.5 py-1 text-xs w-20 text-right font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={r.category}
                          onChange={(e) => updateRow(r.tempId, { category: e.target.value })}
                          className={`bg-background border rounded px-1.5 py-1 text-xs ${
                            r.category === "Nao Identificado" ? "border-red text-red" : "border-border"
                          }`}
                        >
                          {allCategoryOptions.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeRow(r.tempId)} className="text-faint hover:text-red">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {duplicateCount > 0 && (
            <div className="flex items-start gap-2 text-xs text-red bg-red-soft rounded-lg px-3 py-2 mt-3">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Linhas em vermelho parecem já existir (mesma data e valor) — vieram desmarcadas, marque a caixinha se quiser importar mesmo assim.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red bg-red-soft rounded-lg px-3 py-2 mt-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="bg-gold text-[#1a1305] font-bold text-sm rounded-lg py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending && <Loader2 size={14} className="spin" />}
              Confirmar importação ({includedCount})
            </button>
            <button
              onClick={handleCancelPreview}
              disabled={pending}
              className="text-sm text-muted border border-border rounded-lg py-2 px-4"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!open && accounts.length === 0 && (
        <p className="text-sm text-faint mt-3 flex items-center gap-2">
          <FileText size={14} /> Nenhuma transação importada ainda.
        </p>
      )}
    </div>
  );
}
