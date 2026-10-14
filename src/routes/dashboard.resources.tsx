import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Download, Eye, Library } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadResourceFile } from "@/lib/resource-download-client";

type PurchasedResource = {
  id: number;
  title: string;
  description: string | null;
  priceKes: number;
  purchasedAt: string;
  fileType: string;
};

export const Route = createFileRoute("/dashboard/resources")({
  component: MyResourcesPage,
  head: () => ({ meta: [{ title: "My Resources | Dashboard | Elimusphere" }] }),
});

function MyResourcesPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [resources, setResources] = useState<PurchasedResource[]>([]);
  const [previewResource, setPreviewResource] = useState<PurchasedResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }),
      fetch("/api/resources/purchased", { credentials: "include" }),
    ])
      .then(async ([userResponse, resourcesResponse]) => {
        const userPayload = userResponse.ok ? await userResponse.json() : null;
        const resourcesPayload = resourcesResponse.ok ? await resourcesResponse.json() : null;
        if (cancelled) return;
        setUser(userPayload?.user ?? null);
        if (resourcesResponse.ok) {
          setResources(
            Array.isArray(resourcesPayload?.resources) ? resourcesPayload.resources : [],
          );
        } else if (resourcesResponse.status !== 401) {
          setError(resourcesPayload?.message ?? "Could not load your purchased resources.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your purchased resources. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function download(resourceId: number) {
    downloadResourceFile(resourceId);
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading your resources…
      </main>
    );
  if (!user || (user.role !== "learner" && user.role !== "tutor"))
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Resource access required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in as a learner or tutor to view and download your purchased resources.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button>Sign in</Button>
          </Link>
        </section>
      </main>
    );

  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <section className="border-b border-border pb-8">
          <p className="text-sm font-medium text-primary">Learning workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My Resources</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Your free resources and completed purchases are saved here so you can revisit and
            download them anytime.
          </p>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {resources.length ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => (
              <article key={resource.id} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-primary/10 p-2 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">{resource.title}</h2>
                    {resource.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {resource.priceKes === 0
                    ? "Free resource"
                    : `Purchased ${new Date(resource.purchasedAt).toLocaleDateString()}`}
                </p>
                <Button className="mt-5 w-full" onClick={() => download(resource.id)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  onClick={() => setPreviewResource(resource)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View in app
                </Button>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-dashed bg-card p-10 text-center">
            <Library className="mx-auto h-9 w-9 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">Your library is empty</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free resources and completed purchases appear here automatically.
            </p>
            <Link to="/resources" className="mt-5 inline-block">
              <Button variant="outline">Browse resources</Button>
            </Link>
          </section>
        )}
      </main>
      <ResourcePreviewDialog
        resource={previewResource}
        onClose={() => setPreviewResource(null)}
        onDownload={download}
      />
    </DashboardShell>
  );
}

function ResourcePreviewDialog({
  resource,
  onClose,
  onDownload,
}: {
  resource: PurchasedResource | null;
  onClose: () => void;
  onDownload: (resourceId: number) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resourceId = resource?.id;
  const fileType = resource?.fileType.toLowerCase() ?? "";
  const isDocx =
    fileType === "docx" ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isPdf = fileType === "pdf" || fileType === "application/pdf";
  const isImage = ["gif", "jpeg", "jpg", "png", "webp"].includes(fileType);
  const canPreview = isDocx || isPdf || isImage;

  useEffect(() => {
    if (!resourceId || !canPreview) {
      setPreviewUrl(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");
    setPreviewUrl(null);
    if (bodyRef.current) bodyRef.current.replaceChildren();
    if (stylesRef.current) stylesRef.current.replaceChildren();

    async function loadPreview() {
      try {
        const response = await fetch(`/api/resources/${resourceId}/download`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Could not load this resource preview.");
        }
        const blob = await response.blob();
        if (isDocx) {
          const { renderAsync } = await import("docx-preview");
          if (!bodyRef.current || !stylesRef.current) return;
          await renderAsync(await blob.arrayBuffer(), bodyRef.current, stylesRef.current, {
            useBase64URL: true,
            renderAltChunks: false,
          });
        } else {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        }
      } catch (previewError) {
        if (controller.signal.aborted) return;
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Could not load this resource preview.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resourceId, canPreview, isDocx]);

  return (
    <Dialog
      open={Boolean(resource)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{resource?.title ?? "Resource preview"}</DialogTitle>
          <DialogDescription>
            Previewing a private copy of this resource from your library.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[50vh] flex-1 overflow-auto rounded-lg border bg-muted/30">
          {loading ? (
            <p
              role="status"
              className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground"
            >
              Loading resource preview…
            </p>
          ) : error ? (
            <p
              role="alert"
              className="grid min-h-[50vh] place-items-center p-6 text-center text-sm text-destructive"
            >
              {error}
            </p>
          ) : !canPreview ? (
            <div className="grid min-h-[50vh] place-items-center p-6 text-center">
              <div>
                <p className="font-medium">In-app preview is not available for this file type.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Download the resource to open it with a compatible app.
                </p>
              </div>
            </div>
          ) : isDocx ? (
            <div className="max-h-[70vh] overflow-auto">
              <div ref={stylesRef} />
              <div ref={bodyRef} />
            </div>
          ) : isPdf ? (
            previewUrl ? (
              <iframe
                className="h-[70vh] w-full"
                src={previewUrl}
                title={`Preview of ${resource?.title ?? "resource"}`}
              />
            ) : null
          ) : previewUrl ? (
            <div className="grid min-h-[50vh] place-items-center p-4">
              <img
                className="max-h-[68vh] max-w-full object-contain"
                src={previewUrl}
                alt={`Preview of ${resource?.title ?? "resource"}`}
              />
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (resource) onDownload(resource.id);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
