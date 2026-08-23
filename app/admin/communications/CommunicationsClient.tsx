"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ContentPage = {
  id: string;
  page_key: string;
  title: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type Account = {
  user_id: string;
  email: string | null;
  buyer_display_name: string | null;
  seller_storefront_name: string | null;
  business_display_name: string | null;
};

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean | null;
  action_url: string | null;
  created_at: string | null;
};

type Payload = {
  pages: ContentPage[];
  accounts: Account[];
  notifications: Notification[];
};

const notificationTypes = ["system", "order", "payment", "shipping", "promo", "message"] as const;

export default function CommunicationsClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [pageActive, setPageActive] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [notificationType, setNotificationType] = useState<(typeof notificationTypes)[number]>("system");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationActionUrl, setNotificationActionUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/communications", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load communications operations");
      setData(body);
      setTargetUserId((current) => current || body.accounts?.[0]?.user_id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load communications operations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accountsById = useMemo(() => {
    const map = new Map<string, Account>();
    for (const account of data?.accounts ?? []) map.set(account.user_id, account);
    return map;
  }, [data]);

  function resetPageForm() {
    setEditingPageId(null);
    setPageKey("");
    setPageTitle("");
    setPageContent("");
    setPageActive(true);
  }

  function editPage(page: ContentPage) {
    setEditingPageId(page.id);
    setPageKey(page.page_key);
    setPageTitle(page.title);
    setPageContent(page.content ?? "");
    setPageActive(page.is_active !== false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveContent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveContent",
          pageId: editingPageId,
          pageKey,
          title: pageTitle,
          content: pageContent,
          metadata: {},
          isActive: pageActive,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save content page");
      resetPageForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save content page");
    } finally {
      setSaving(false);
    }
  }

  async function sendNotification(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendNotification",
          userId: targetUserId,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          actionUrl: notificationActionUrl || null,
          metadata: {},
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send notification");
      setNotificationTitle("");
      setNotificationMessage("");
      setNotificationActionUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send notification");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="rounded-xl border p-8 text-sm opacity-70">Loading communications operations…</div>;
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <div>{error}</div>
          <button className="mt-2 underline" onClick={() => void load()} type="button">Retry</button>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveContent} className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Marketplace content</h2>
            <p className="mt-1 text-sm opacity-65">Publish or retire EntizNetStore-controlled policy/help pages. Public readers see active pages only.</p>
          </div>
          <label className="block text-sm">
            Page key
            <input className="mt-1 w-full rounded border px-3 py-2" value={pageKey} onChange={(e) => setPageKey(e.target.value)} placeholder="terms-of-service" required />
          </label>
          <label className="block text-sm">
            Title
            <input className="mt-1 w-full rounded border px-3 py-2" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Content
            <textarea className="mt-1 min-h-48 w-full rounded border px-3 py-2" value={pageContent} onChange={(e) => setPageContent(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pageActive} onChange={(e) => setPageActive(e.target.checked)} />
            Publicly active
          </label>
          <div className="flex gap-3">
            <button disabled={saving} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50" type="submit">
              {editingPageId ? "Save changes" : "Create page"}
            </button>
            {editingPageId ? <button type="button" onClick={resetPageForm} className="rounded border px-4 py-2 text-sm">Cancel edit</button> : null}
          </div>
        </form>

        <form onSubmit={sendNotification} className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Targeted notification</h2>
            <p className="mt-1 text-sm opacity-65">Send an audited in-app notification to one marketplace account. External/open-redirect action URLs are rejected.</p>
          </div>
          <label className="block text-sm">
            Account
            <select className="mt-1 w-full rounded border px-3 py-2" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
              {(data?.accounts ?? []).map((account) => (
                <option key={account.user_id} value={account.user_id}>
                  {account.email || account.buyer_display_name || account.seller_storefront_name || account.business_display_name || account.user_id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Type
            <select className="mt-1 w-full rounded border px-3 py-2" value={notificationType} onChange={(e) => setNotificationType(e.target.value as (typeof notificationTypes)[number])}>
              {notificationTypes.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Title
            <input className="mt-1 w-full rounded border px-3 py-2" value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Message
            <textarea className="mt-1 min-h-28 w-full rounded border px-3 py-2" value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Optional action path
            <input className="mt-1 w-full rounded border px-3 py-2" value={notificationActionUrl} onChange={(e) => setNotificationActionUrl(e.target.value)} placeholder="/orders" />
          </label>
          <button disabled={saving || !targetUserId} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50" type="submit">Send notification</button>
        </form>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Published content</h2>
        <div className="mt-4 overflow-x-auto">
          {(data?.pages ?? []).length === 0 ? <p className="text-sm opacity-65">No EntizNetStore content pages yet.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-2">Key</th><th>Title</th><th>Status</th><th>Updated</th><th /></tr></thead>
              <tbody>
                {(data?.pages ?? []).map((page) => (
                  <tr key={page.id} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs">{page.page_key}</td>
                    <td>{page.title}</td>
                    <td>{page.is_active === false ? "Inactive" : "Active"}</td>
                    <td>{page.updated_at ? new Date(page.updated_at).toLocaleString() : "—"}</td>
                    <td className="text-right"><button type="button" className="underline" onClick={() => editPage(page)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Recent notification operations</h2>
        <div className="mt-4 space-y-3">
          {(data?.notifications ?? []).length === 0 ? <p className="text-sm opacity-65">No notifications have been sent yet.</p> : null}
          {(data?.notifications ?? []).map((notification) => {
            const account = accountsById.get(notification.user_id);
            return (
              <div key={notification.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{notification.title}</strong>
                  <span className="opacity-60">{notification.created_at ? new Date(notification.created_at).toLocaleString() : ""}</span>
                </div>
                <div className="mt-1 opacity-75">{notification.message}</div>
                <div className="mt-2 text-xs opacity-60">
                  {notification.type} · {account?.email || notification.user_id} · {notification.read ? "read" : "unread"}{notification.action_url ? ` · ${notification.action_url}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
