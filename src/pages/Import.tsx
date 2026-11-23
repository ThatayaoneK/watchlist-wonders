import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bookmarkService } from "@/services/bookmarks";
import { parseImdbCsv, importRows } from "@/services/importService";
import type { ImportRow } from "@/services/importService";

const IMDB_EXPORT_URL = "https://www.imdb.com/list/watchlist/export";

type ImportStep = "upload" | "preview" | "importing" | "done";

export default function Import() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const { data: existingBookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 60 * 1000,
  });

  const existingTitles = new Set(
    existingBookmarks.map((b) => b.title.trim().toLowerCase()),
  );

  function handleFile(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseImdbCsv(text);
      if (parsed.length === 0) {
        setParseError("No titles found. Make sure you uploaded an IMDb watchlist export (.csv).");
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    setStep("importing");
    setProgress(0);

    const importResult = await importRows(rows, new Set(existingTitles), (done, total) => {
      setProgress(Math.round((done / total) * 100));
    });

    setResult(importResult);
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
  }

  const newRows = rows.filter((r) => !existingTitles.has(r.title.trim().toLowerCase()));
  const duplicateCount = rows.length - newRows.length;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Import from IMDb</h1>
            <p className="text-sm text-muted-foreground">Bring your existing watchlist in one go</p>
          </div>
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to export from IMDb:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Go to your{" "}
                  <a
                    href={IMDB_EXPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    IMDb Watchlist
                  </a>
                </li>
                <li>Click the three-dot menu → <strong className="text-foreground">Export</strong></li>
                <li>Save the downloaded <code className="text-xs bg-muted px-1 py-0.5 rounded">.csv</code> file</li>
                <li>Upload it below</li>
              </ol>
              <a
                href={IMDB_EXPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-1"
              >
                <Download className="w-3.5 h-3.5" />
                Open IMDb Watchlist export page
              </a>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <Upload className={cn("w-8 h-8", dragOver ? "text-primary" : "text-muted-foreground")} />
              <div className="text-center">
                <p className="font-medium text-foreground text-sm">Drop your CSV file here</p>
                <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileInput}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {rows.length} title{rows.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {newRows.length} new · {duplicateCount} already in your list (will be skipped)
                </p>
              </div>
              <Button size="sm" className="shrink-0 ml-auto" onClick={handleImport} disabled={newRows.length === 0}>
                Import {newRows.length > 0 ? newRows.length : ""} titles
              </Button>
            </div>

            {/* Preview table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Title</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Year</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const isDupe = existingTitles.has(row.title.trim().toLowerCase());
                      return (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-border/50 last:border-0",
                            isDupe ? "opacity-40" : "hover:bg-muted/30"
                          )}
                        >
                          <td className="px-3 py-2 font-medium text-foreground truncate max-w-[200px]">
                            {row.title}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground capitalize text-xs">
                            {row.titleType.replace("tvseries", "series").replace("tvminiseries", "mini") || "movie"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{row.year ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {isDupe ? (
                              <span className="text-[10px] text-muted-foreground">duplicate</span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">+ import</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => { setRows([]); setStep("upload"); }}>
              Choose a different file
            </Button>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <div>
              <p className="font-semibold text-foreground">Importing titles…</p>
              <p className="text-sm text-muted-foreground mt-0.5">{progress}% complete</p>
            </div>
            <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Adding to your watchlist in the background…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-5 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div>
              <p className="text-xl font-bold text-foreground">Import complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.imported} title{result.imported !== 1 ? "s" : ""} added to your watchlist
                {result.skipped > 0 ? ` · ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped` : ""}
                {result.failed > 0 ? ` · ${result.failed} failed` : ""}
              </p>
            </div>

            {result.errors.length > 0 && (
              <details className="w-full text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} (click to expand)
                </summary>
                <ul className="mt-2 space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-destructive">{err}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
              <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); setResult(null); }}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
