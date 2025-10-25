'use client';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useRouter } from 'next/navigation';

const setCookie = (k:string,v:string) =>
  document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=${60*60*24*365}`;

export default function LanguageCurrencySwitcher({ className }: { className?: string }) {
  const { locale, currency, setLocale, setCurrency } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const chooseLocale = (l:string) => { setLocale(l as any); setCookie('locale', l); localStorage.setItem('locale', l); setOpen(false); router.refresh(); };
  const chooseCurrency = (c:string) => { setCurrency(c as any); setCookie('currency', c); localStorage.setItem('currency', c); setOpen(false); router.refresh(); };

  const LANGS = [{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'fr',label:'Français'},{code:'ja',label:'日本語'},{code:'zh',label:'中文'},{code:'vi',label:'Tiếng Việt'},{code:'th',label:'ไทย'}];
  const CCYS = ['USD','EUR','GBP','CNY','JPY','PHP'];

  return (
    <div ref={box} className={className}>
      <button onClick={() => setOpen(v=>!v)} className="px-3 py-1 rounded-md bg-foreground/10 hover:bg-foreground/20">
        {locale?.toUpperCase()} • {currency}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-60 rounded-md border border-white/10 bg-black/85 backdrop-blur p-2 space-y-2">
          <div>
            <div className="text-xs uppercase opacity-70 mb-1">Language</div>
            <div className="grid grid-cols-2 gap-1">
              {LANGS.map(l=>(
                <button key={l.code} onClick={()=>chooseLocale(l.code)} className={`px-2 py-1 rounded text-left hover:bg-white/10 ${locale===l.code?'bg-white/10':''}`}>{l.label}</button>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10" />
          <div>
            <div className="text-xs uppercase opacity-70 mb-1">Currency</div>
            <div className="grid grid-cols-3 gap-1">
              {CCYS.map(c=>(
                <button key={c} onClick={()=>chooseCurrency(c)} className={`px-2 py-1 rounded hover:bg-white/10 ${currency===c?'bg-white/10':''}`}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
