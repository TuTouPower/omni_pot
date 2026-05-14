/* global React */
const { useState, useMemo, useEffect, useRef } = React;

// ============== SVG ICONS (minimal, mono) ==============
const Icon = ({ d, size = 15, sw = 1.85, fill = false, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const Icons = {
  Close: (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  Min: (p) => <Icon {...p} d="M5 12h14" />,
  Max: (p) => <Icon {...p} d="M5 5h14v14H5z" />,
  Restore: (p) => <Icon {...p} d={["M8 8h11v11H8z","M5 5h11v3","M5 5v11h3"]} />,
  Pin: (p) => <Icon {...p} d={["M12 17v5","M9 3h6l-1 6 3 3H7l3-3-1-6z"]} />,
  Translate: (p) => <Icon {...p} d={["M4 5h10","M9 4v2c0 4-3 8-7 8","M14 19l3-8 3 8","M15 16h4","M5 8c0 3 4 7 8 7"]} />,
  Volume: (p) => <Icon {...p} d={["M11 5L6 9H3v6h3l5 4V5z","M15 9a4 4 0 010 6","M18 6a8 8 0 010 12"]} />,
  Copy: (p) => <Icon {...p} d={["M8 8h11v11H8z","M5 5h11v3","M5 5v11h3"]} />,
  Trash: (p) => <Icon {...p} d={["M4 7h16","M9 7V4h6v3","M6 7l1 13h10l1-13"]} />,
  Newline: (p) => <Icon {...p} d={["M20 6v6a3 3 0 01-3 3H5","M9 11l-4 4 4 4"]} />,
  Swap: (p) => <Icon {...p} d={["M7 7h13l-3-3","M17 17H4l3 3"]} />,
  Chev: (p) => <Icon {...p} d="M6 9l6 6 6-6" />,
  ChevR: (p) => <Icon {...p} d="M9 6l6 6-6 6" />,
  Plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  Search: (p) => <Icon {...p} d={["M11 19a8 8 0 100-16 8 8 0 000 16z","M21 21l-4.3-4.3"]} />,
  Settings: (p) => <Icon {...p} d={["M12 9a3 3 0 100 6 3 3 0 000-6z","M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1A2 2 0 114.6 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1A2 2 0 117 4.6l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1A2 2 0 1119.4 7l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"]} />,
  Camera: (p) => <Icon {...p} d={["M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z","M12 17a4 4 0 100-8 4 4 0 000 8z"]} />,
  Image: (p) => <Icon {...p} d={["M3 5h18v14H3z","M3 16l5-5 4 4 3-3 6 6","M9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"]} />,
  Hash: (p) => <Icon {...p} d={["M4 9h16","M4 15h16","M10 3l-2 18","M16 3l-2 18"]} />,
  Layers: (p) => <Icon {...p} d={["M12 2l9 5-9 5-9-5 9-5z","M3 12l9 5 9-5","M3 17l9 5 9-5"]} />,
  Kbd: (p) => <Icon {...p} d={["M3 7h18v10H3z","M7 11h0M11 11h0M15 11h0M7 14h10"]} />,
  Clock: (p) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z","M12 7v5l3 2"]} />,
  Cloud: (p) => <Icon {...p} d="M18 18H7a4 4 0 01-1-7.9 6 6 0 0111.7-1A4 4 0 0118 18z" />,
  Export: (p) => <Icon {...p} d={["M3 14v4a2 2 0 002 2h14a2 2 0 002-2v-4","M7 10l5-5 5 5","M12 5v12"]} />,
  Info: (p) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z","M12 16v-5","M12 8h0"]} />,
  Grid: (p) => <Icon {...p} d={["M3 3h7v7H3z","M14 3h7v7h-7z","M3 14h7v7H3z","M14 14h7v7h-7z"]} />,
  Drag: (p) => <Icon {...p} d={["M9 5h0M9 12h0M9 19h0M15 5h0M15 12h0M15 19h0"]} sw={2.4} />,
  Edit: (p) => <Icon {...p} d={["M12 20h9","M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"]} />,
  Cycle: (p) => <Icon {...p} d={["M21 12a9 9 0 11-3-6.7","M21 4v5h-5"]} />,
  Heart: (p) => <Icon {...p} d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />,
  Reverse: (p) => <Icon {...p} d={["M3 12c0-5 4-9 9-9","M21 12c0 5-4 9-9 9","M3 7v5h5","M21 17v-5h-5"]} />,
  Check: (p) => <Icon {...p} d="M5 12l5 5L20 7" />,
  Dot: (p) => <Icon {...p} d="M12 12h0" sw={4} />,
  Bell: (p) => <Icon {...p} d={["M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9","M14 21a2 2 0 01-4 0"]} />,
  Globe: (p) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z","M3 12h18","M12 3a14 14 0 010 18","M12 3a14 14 0 000 18"]} />,
  Type: (p) => <Icon {...p} d={["M4 7V5h16v2","M9 5v14","M15 5v14","M7 19h4M13 19h4"]} />,
  Sliders: (p) => <Icon {...p} d={["M4 6h10","M18 6h2","M4 12h4","M12 12h8","M4 18h12","M18 18h2","M16 4v4","M10 10v4","M16 16v4"]} />,
  Brain: (p) => <Icon {...p} d={["M9 4a3 3 0 013 3v10a3 3 0 11-6 0V9a3 3 0 013-3","M15 4a3 3 0 00-3 3v10a3 3 0 106 0V9a3 3 0 00-3-3"]} />,
};

// Service brand monograms — no real logos, we use mono initials
const SVC_META = {
  // translate
  deepl: { name: 'DeepL', mono: 'DL', tone: 'oklch(70% 0.10 240)' },
  bing: { name: 'Bing', mono: 'BG', tone: 'oklch(65% 0.10 200)' },
  google: { name: 'Google', mono: 'GG', tone: 'oklch(68% 0.10 130)' },
  yandex: { name: 'Yandex', mono: 'YD', tone: 'oklch(65% 0.13 25)' },
  lingva: { name: 'Lingva', mono: 'LV', tone: 'oklch(65% 0.10 170)' },
  ecdict: { name: 'ECDict', mono: 'EC', tone: 'oklch(64% 0.10 60)' },
  openai: { name: 'OpenAI', mono: 'AI', tone: 'oklch(58% 0.02 180)' },
  geminipro: { name: 'Gemini', mono: 'GM', tone: 'oklch(64% 0.12 280)' },
  chatglm: { name: 'ChatGLM', mono: 'GL', tone: 'oklch(60% 0.12 30)' },
  ollama: { name: 'Ollama', mono: 'OL', tone: 'oklch(55% 0.005 70)' },
  baidu: { name: '百度', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
  baidu_field: { name: '百度领域', mono: 'BF', tone: 'oklch(58% 0.16 250)' },
  bing_dict: { name: 'Bing 词典', mono: 'BD', tone: 'oklch(65% 0.10 200)' },
  caiyun: { name: '彩云小译', mono: 'CY', tone: 'oklch(70% 0.12 220)' },
  cambridge_dict: { name: 'Cambridge', mono: 'CD', tone: 'oklch(58% 0.13 25)' },
  alibaba: { name: '阿里巴巴', mono: 'AB', tone: 'oklch(60% 0.15 30)' },
  tencent: { name: '腾讯', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
  transmart: { name: 'TranSmart', mono: 'TS', tone: 'oklch(60% 0.13 230)' },
  volcengine: { name: '火山引擎', mono: 'VE', tone: 'oklch(60% 0.13 25)' },
  niutrans: { name: '牛翻译', mono: 'NT', tone: 'oklch(64% 0.12 145)' },
  youdao: { name: '有道', mono: 'YD', tone: 'oklch(58% 0.13 25)' },
  // ocr
  system: { name: '系统 OCR', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
  tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
  baidu_ocr: { name: '百度 OCR', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
  baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
  tencent_ocr: { name: '腾讯 OCR', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
  iflytek_ocr: { name: '讯飞 OCR', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
  iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
  openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
  qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
  // tts
  edge_tts: { name: 'Edge TTS', mono: 'ED', tone: 'oklch(60% 0.13 230)' },
  lingva_tts: { name: 'Lingva TTS', mono: 'LV', tone: 'oklch(65% 0.10 170)' },
  // collection
  anki: { name: 'Anki', mono: 'AK', tone: 'oklch(58% 0.13 25)' },
  eudic: { name: '欧路词典', mono: 'EU', tone: 'oklch(60% 0.13 145)' },
};

const SvcTile = ({ name, size = 24 }) => {
  const m = SVC_META[name] || { mono: name.slice(0,2).toUpperCase(), tone: 'oklch(55% 0.005 70)' };
  return (
    <div className={'svc-tile' + (size >= 32 ? ' lg' : '')} style={{ color: m.tone, borderColor: 'color-mix(in oklab, ' + m.tone + ' 30%, var(--line))' }}>
      {m.mono}
    </div>
  );
};

// Flag chip — 2 letters since we don't ship real flags
const LANG_LABEL = {
  auto: 'AUTO', zh_cn: 'ZH', zh_tw: 'TW', yue: 'YUE', en: 'EN', ja: 'JA', ko: 'KO', fr: 'FR',
  es: 'ES', ru: 'RU', de: 'DE', it: 'IT', tr: 'TR', pt_pt: 'PT', pt_br: 'BR', vi: 'VI',
  id: 'ID', th: 'TH', ms: 'MS', ar: 'AR', hi: 'HI', km: 'KM', nb_no: 'NB', fa: 'FA',
  sv: 'SV', pl: 'PL', nl: 'NL', uk: 'UK', he: 'HE',
};
const LANG_NAME = {
  auto: '自动检测', zh_cn: '简体中文', zh_tw: '繁體中文', yue: '粵語', en: 'English', ja: '日本語',
  ko: '한국어', fr: 'Français', es: 'Español', ru: 'Русский', de: 'Deutsch', it: 'Italiano',
  tr: 'Türkçe', pt_pt: 'Português', pt_br: 'Português (BR)', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
  th: 'ไทย', ms: 'Bahasa Melayu', ar: 'العربية', hi: 'हिन्दी', km: 'ខ្មែរ', nb_no: 'Norsk',
  fa: 'فارسی', sv: 'Svenska', pl: 'Polski', nl: 'Nederlands', uk: 'Українська', he: 'עברית',
};
const Flag = ({ code }) => <span className="flag">{LANG_LABEL[code] || code.slice(0,2).toUpperCase()}</span>;

// Window chrome — frameless, custom controls (cross-platform neutral)
const Titlebar = ({ title, right, hideControls }) => (
  <div className="op-titlebar">
    <div className="op-wordmark"><span className="dot" />{title || 'omni_pot'}</div>
    <div className="spacer" />
    {right}
    {!hideControls && (
      <div className="op-wmctl">
        <button title="最小化"><Icons.Min /></button>
        <button title="最大化"><Icons.Max /></button>
        <button className="close" title="关闭"><Icons.Close /></button>
      </div>
    )}
  </div>
);

// Small re-usable bits
const Switch = ({ on, onChange }) => (
  <div className={'switch' + (on ? ' on' : '')} onClick={() => onChange && onChange(!on)} />
);

const Select = ({ value, label, options, onChange, style }) => {
  const [open, setOpen] = useState(false);
  const cur = options?.find(o => o.value === value);
  return (
    <div className="select" style={style} onClick={() => setOpen(o => !o)}>
      {label && <span style={{ color: 'var(--text-mute)' }}>{label}</span>}
      <span>{cur?.label || value}</span>
      <Icons.Chev className="chev" size={12} />
      {open && options && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', padding: 4, zIndex: 50, maxHeight: 280, overflowY: 'auto' }}>
          {options.map(o => (
            <div key={o.value} onClick={(e) => { e.stopPropagation(); onChange && onChange(o.value); setOpen(false); }}
              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: o.value === value ? 'var(--brand-primary-soft)' : 'transparent', color: o.value === value ? 'var(--brand-primary)' : 'var(--text)' }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg-sunk)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}>
              {o.icon}{o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LangSelect = ({ value, onChange, codes, style }) => {
  const opts = codes.map(c => ({ value: c, label: <span style={{display:'flex',alignItems:'center',gap:8}}><Flag code={c}/>{LANG_NAME[c] || c}</span> }));
  return <Select value={value} onChange={onChange} options={opts} style={style} />;
};

Object.assign(window, { Icon, Icons, SVC_META, SvcTile, LANG_LABEL, LANG_NAME, Flag, Titlebar, Switch, Select, LangSelect });
