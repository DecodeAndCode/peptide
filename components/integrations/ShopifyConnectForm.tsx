"use client";

import { useState, useTransition } from "react";

interface ShopifyConnectFormProps {
  onConnected: (result: { shopDomain: string; shopName: string }) => void;
  /** "full" = settings card body; "compact" = onboarding inline panel */
  variant?: "full" | "compact";
}

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const ACCESS_TOKEN_PATTERN = /^shpat_[A-Za-z0-9]{20,}$/;

export function ShopifyConnectForm({ onConnected, variant = "full" }: ShopifyConnectFormProps) {
  const [shopInput, setShopInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const rawShop = shopInput.trim().toLowerCase();
    const rawToken = tokenInput.trim();
    if (!rawShop) {
      setMessage("Enter your *.myshopify.com domain to connect.");
      return;
    }
    const normalized = rawShop.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!SHOP_DOMAIN_PATTERN.test(normalized)) {
      setMessage("Enter a valid *.myshopify.com domain (e.g. acme-supplements.myshopify.com).");
      return;
    }
    if (!ACCESS_TOKEN_PATTERN.test(rawToken)) {
      setMessage("Paste an Admin API access token (starts with shpat_).");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/integrations/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: normalized, accessToken: rawToken }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        shopDomain?: string;
        shopName?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        setMessage(payload.error ?? "Shopify connection failed. Please try again.");
        return;
      }
      setTokenInput("");
      setMessage(`Connected to ${payload.shopName ?? payload.shopDomain ?? normalized}.`);
      onConnected({
        shopDomain: payload.shopDomain ?? normalized,
        shopName: payload.shopName ?? normalized,
      });
    });
  }

  const labelClass = "text-xs font-medium text-dark";
  const inputClass =
    "mt-1 w-full rounded-card border border-sage/20 bg-white px-4 py-2.5 text-sm text-dark outline-none transition-colors duration-200 focus:border-sage";
  const buttonClass = "btn-primary px-4 py-2.5 text-sm disabled:opacity-60";
  const wrapperClass =
    variant === "compact"
      ? "space-y-3 rounded-card border border-sage/20 bg-white p-5"
      : "space-y-3";

  return (
    <div className={wrapperClass}>
      <div>
        <label className={labelClass} htmlFor="shopify-shop">
          Shopify store domain
        </label>
        <input
          id="shopify-shop"
          type="text"
          inputMode="url"
          placeholder="acme-supplements.myshopify.com"
          value={shopInput}
          onChange={(event) => setShopInput(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="shopify-token">
          Admin API access token
        </label>
        <input
          id="shopify-token"
          type="password"
          autoComplete="off"
          placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          className={`${inputClass} font-mono`}
        />
        <p className="mt-1 text-[11px] text-mid">
          Shopify shows this token <strong>only once</strong>. Paste it here immediately after revealing.
        </p>
      </div>

      <details className="rounded-card border border-sage/10 bg-sage/[0.03] p-3 text-xs leading-6 text-mid">
        <summary className="cursor-pointer font-medium text-dark">
          How do I get this token?
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Open <code>your-store.myshopify.com/admin</code> → <strong>Settings</strong> →
            <strong> Apps and sales channels</strong> → <strong>Develop apps</strong>. If prompted,
            click <strong>Allow custom app development</strong>.
          </li>
          <li>
            <strong>Create an app</strong> → name it <code>SuppGO</code>.
          </li>
          <li>
            <strong>Configuration</strong> → <strong>Admin API integration</strong> →{" "}
            <strong>Configure</strong>. Grant scopes:{" "}
            <code>read_products, write_products, read_content, write_content</code>. Save.
          </li>
          <li>
            <strong>API credentials</strong> tab → <strong>Install app</strong> → confirm.
          </li>
          <li>
            <strong>Reveal token once</strong> → copy the <code>shpat_…</code> string and paste it
            above. Shopify will not show it again.
          </li>
        </ol>
        <p className="mt-2">
          <strong>Lost the token?</strong> Open your custom app in Shopify → <strong>Uninstall</strong>
          {" "}→ then repeat steps 4–5 to generate a new one.
        </p>
      </details>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className={buttonClass}
      >
        {pending ? "Connecting…" : "Connect Shopify"}
      </button>

      {message ? <p className="text-sm text-mid">{message}</p> : null}
    </div>
  );
}
