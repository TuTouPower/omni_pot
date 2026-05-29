/* global React, Switch, Select, LangSelect, Flag, SvcTile, Icons, LANG_NAME, LANG_LABEL */
const { useState: useStateT, useEffect: useEffectT, useRef: useRefT, useReducer: useReducerT } = React;

// Wrapper for icons loaded asynchronously from react-icons (esm.sh).
// Re-renders when the icons-loaded event fires.
const ReactIcon = ({ name, size = 16, style }) => {
  const [, force] = useReducerT((x) => x + 1, 0);
  useEffectT(() => {
    if (window[name]) return;
    const h = () => force();
    window.addEventListener('react-icons-loaded', h);
    return () => window.removeEventListener('react-icons-loaded', h);
  }, [name]);
  const Cmp = window[name];
  if (!Cmp) return <span style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  return <Cmp size={size} style={style} />;
};

// Source-language list (auto + most-used). Reused for both source & target,
// but source includes "auto".
const SOURCE_LANGS = ['auto', 'en', 'zh_cn', 'zh_tw', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'it', 'pt_pt', 'vi', 'th', 'ar'];
const TARGET_LANGS = SOURCE_LANGS.filter((c) => c !== 'auto');

// Inline language dropdown — visually matches the previous LangPick (transparent,
// bigger text, chevron). Menu is PORTALED to document.body so it can escape
// card overflow:hidden AND the DesignCanvas's transform (which would otherwise
// trap position:fixed). Languages shown in NATIVE script.
const LangDropdown = ({ value, onChange, codes }) => {
  const [open, setOpen] = useStateT(false);
  const [coords, setCoords] = useStateT({ left: 0, top: 0, maxH: 280 });
  const triggerRef = useRefT(null);
  const popRef = useRefT(null);

  const POP_W = 180;
  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popH = Math.min(320, codes.length * 30 + 8);
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < popH + 12 && r.top > popH + 12;
    // Center horizontally under the trigger.
    const wantLeft = r.left + r.width / 2 - POP_W / 2;
    const left = Math.min(Math.max(8, wantLeft), window.innerWidth - POP_W - 8);
    setCoords({
      left,
      top: above ? r.top - popH - 6 : r.bottom + 6,
      maxH: popH
    });
  };

  useEffectT(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    const onDoc = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const pop = open && ReactDOM.createPortal(
    <div ref={popRef} style={{
      position: 'fixed', left: coords.left, top: coords.top,
      width: POP_W, maxHeight: coords.maxH, overflowY: 'auto',
      background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
      boxShadow: '0 10px 28px rgba(0,0,0,0.14)', padding: 4, zIndex: 10000
    }}>
      {codes.map((c) => {
        const active = c === value;
        return (
          <div key={c}
          onClick={(e) => {e.stopPropagation();onChange && onChange(c);setOpen(false);}}
          style={{
            padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            background: active ? 'var(--brand-primary-soft)' : 'transparent',
            color: active ? 'var(--brand-primary)' : 'var(--text)',
            fontSize: 13, whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {if (!active) e.currentTarget.style.background = 'var(--bg-sunk)';}}
          onMouseLeave={(e) => {if (!active) e.currentTarget.style.background = 'transparent';}}>
            {LANG_NAME[c] || c}
          </div>);

      })}
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {e.stopPropagation();setOpen((o) => !o);}}
        style={{
          height: 28, padding: '0 6px',
          background: open ? 'var(--brand-primary-soft)' : 'transparent',
          border: 0, color: 'var(--text)',
          fontSize: 13.5, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          borderRadius: 6, cursor: 'pointer'
        }}>
        {LANG_NAME[value] || value}
        <Icons.Chev size={12} style={{ color: 'var(--text-mute)', marginTop: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {pop}
    </>);

};

// Plain titlebar — pin LEFT, then always-on-top, then wordmark, then mode label, spacer, close.
//
// Two independent toggles (per issues.md):
//   ・ 固定 (Pin): window doesn't auto-close on blur
//   ・ 置顶 (Always-on-top): window stays above other windows; turning ON
//                                  also activates 固定, but the reverse doesn't hold.
//
// `noPin` hides BOTH the lock and the thumbtack — used for windows that
// always behave as modal/centered (updater, settings).
//
// `chrome="wmctl"` swaps the right-side close for the full minimise /
// maximise / close trio — used by the Settings window per spec.
const TitlebarLeft = ({ mode = '翻译', pinned: pinnedProp = false, onTop: onTopProp = false, noPin = false, chrome = 'close' }) => {
  const [pinned, setPinned] = useStateT(!!pinnedProp);
  const [onTop, setOnTop] = useStateT(!!onTopProp);
  const togglePin = () => { setPinned((p) => !p); };
  const toggleTop = () => {
    setOnTop((t) => {
      const next = !t;
      if (next) setPinned(true); // turning on 置顶 forces 固定 on
      return next;
    });
  };
  // Visual states (per Feng): inactive = stroke-only outline of the glyph;
  // active = same glyph filled with brand primary. No button outline ever.
  const TitleBtn = ({ title, active, onClick, children }) =>
  <button title={title} onClick={onClick}
  style={{
    width: 30, height: 30, borderRadius: 6, display: 'grid', placeItems: 'center',
    color: 'var(--brand-primary)',
    background: 'transparent',
    border: 0, padding: 0,
    WebkitAppRegion: 'no-drag',
    cursor: 'pointer'
  }}>
      {children}
    </button>;

  // Lock glyph with a knocked-out keyhole when filled — the keyhole stroke
  // switches to the window background colour so it reads as an inverse cut
  // through the brand-coloured lock body. Works in both light & dark themes
  // because --bg adapts.
  const LockGlyph = ({ size, filled }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d="M5 11h14v10H5z" fill={filled ? 'currentColor' : 'none'} />
    <path d="M8 11V7a4 4 0 018 0v4" />
    <path d="M12 15v3" stroke={filled ? 'var(--bg)' : 'currentColor'} />
  </svg>;

  return (
    <div className="op-titlebar">
      {!noPin && (
      <div style={{ display: 'flex', gap: 2, WebkitAppRegion: 'no-drag' }}>
        {/* 置顶 — thumbtack icon (first) */}
        <TitleBtn title={onTop ? '取消置顶' : '置顶 (始终在最前)'} active={onTop} onClick={toggleTop}>
          <Icons.Pin size={25} fill={onTop} />
        </TitleBtn>
        {/* 固定 — lock icon (second) */}
        <TitleBtn title={pinned ? '取消固定 (失焦不关闭)' : '固定 (失焦不关闭)'} active={pinned} onClick={togglePin}>
          <LockGlyph size={24} filled={pinned} />
        </TitleBtn>
      </div>
      )}
      <div className="op-wordmark" style={{ marginLeft: noPin ? 4 : 2 }}>
        Omni Pot
      </div>
      <span className="op-mode">{mode}</span>
      <div className="spacer" />
      {chrome === 'wmctl' ? (
        <div className="op-wmctl" style={{ WebkitAppRegion: 'no-drag' }}>
          <button title="最小化"><Icons.Min size={15} /></button>
          <button title="最大化"><Icons.Max size={13} /></button>
          <button className="close" title="关闭"><Icons.Close size={15} /></button>
        </div>
      ) : (
        <button className="op-close" title="关闭"
        style={{
          width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center',
          color: 'var(--text-mute)',
          background: 'transparent',
          WebkitAppRegion: 'no-drag'
        }}>
          <Icons.Close size={18} />
        </button>
      )}
    </div>);

};

const SOURCE_BUTTONS = [
{ icon: <ReactIcon name="MdSmartButton" size={17} />, title: '去除换行' },
{ icon: <ReactIcon name="CgSpaceBetween" size={17} />, title: '去除空格' },
{ kind: 'volume' },
{ icon: <Icons.Copy size={16} />, title: '复制原文' },
{ icon: <Icons.Trash size={16} />, title: '清空' }];


const svcLabel = (name) => (window.SVC_META[name] || {}).name || name;

// Volume / speak button with idle → busy (loading dots) → playing (brand-filled).
// Clicking cycles state. Three visible states keep implementations honest.
const VolumeButton = ({ size = 16 }) => {
  const [state, setState] = useStateT('idle'); // 'idle' | 'busy' | 'playing'
  const next = () => setState((s) => s === 'idle' ? 'busy' : s === 'busy' ? 'playing' : 'idle');
  const title = state === 'idle' ? '朗读' : state === 'busy' ? '正在准备…' : '停止朗读';
  const active = state === 'playing';
  return (
    <button
      className={'ic-btn' + (active ? ' brand' : '')}
      title={title}
      onClick={next}
      style={active ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' } : null}>
      {state === 'busy' ?
      <span className="dots" aria-label="加载中"><span /><span /><span /></span> :
      <Icons.Volume size={size} fill={active} />}
    </button>);

};

// Result card.
// Initial / loading state → collapsed (header only), with loading dots in header.
// When result arrives → auto-expand so the user sees the translation.
// Error state → expand & show error text + retry icon button.
const ResultCard = ({ s, r }) => {
  const hasResult = !!(r.text || r.error);
  const [col, setCol] = useStateT(true); // start collapsed
  // Auto-expand once a result (text OR error) arrives. The user can still
  // manually collapse afterwards.
  const seenRef = useRefT(false);
  useEffectT(() => {
    if (hasResult && !seenRef.current) {
      seenRef.current = true;
      setCol(false);
    }
  }, [hasResult]);
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.Drag size={14} style={{ color: 'var(--text-mute)', cursor: 'grab', flex: '0 0 14px' }} />
        <SvcTile name={s.name} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{svcLabel(s.name)}</div>
        {r.loading && !r.error &&
        <span className="dots" aria-label="翻译中" title="翻译中…"><span /><span /><span /></span>
        }
        <div style={{ flex: 1 }} />
        {r.error &&
        <button className="ic-btn" title="重试" style={{ color: 'var(--danger)' }}>
            <Icons.Cycle size={14} />
          </button>
        }
        <VolumeButton />
        <button className="ic-btn" title="复制"><Icons.Copy size={16} /></button>
        <button className="ic-btn" title="收藏"><Icons.Heart size={16} /></button>
        <button className="ic-btn" title={col ? '展开' : '收起'} onClick={() => setCol((c) => !c)}>
          <Icons.Chev size={17} style={{ transform: col ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>

      {!col && (
      r.error ?
      <div style={{ marginTop: 8, marginLeft: 22, color: 'var(--danger)', fontSize: 13 }}>{r.error}</div> :
      r.text ?
      <div style={{ marginTop: 8, marginLeft: 22, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
            {r.text}
          </div> :

      // Expanded but waiting — shimmer lines stand in for the upcoming text.
      <div style={{ marginTop: 8, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="shimmer" style={{ height: 8, width: '90%' }} />
            <div className="shimmer" style={{ height: 8, width: '65%' }} />
          </div>)

      }
    </div>);

};

const TranslateWindow = ({ width = 400, height, sourceText, services, results, pinned = true }) => {
  // Source textarea auto-grows up to ~8 lines (line-height 1.6 * 13.5px ≈ 21.6px)
  // Action row + padding adds ≈64px; we cap the *card* total height accordingly.
  const SOURCE_MAX_LINES = 8;
  const LH = 22; // px per line
  const sourceMaxBody = SOURCE_MAX_LINES * LH; // body region max
  const [srcLang, setSrcLang] = useStateT('auto');
  const [dstLang, setDstLang] = useStateT('zh_cn');
  const swapLangs = () => {
    if (srcLang === 'auto') return;
    setSrcLang(dstLang);setDstLang(srcLang);
  };
  // Window must hug its content per spec #15 — no empty space below the last
  // result card. We let height default to 'auto' so the op-window shrinks to
  // its children. The artboard provides the outer box; when content is shorter
  // than the artboard, the dc-card background fills the rest.
  return (
    <div className="op-window" style={{ width, height: height || 'auto', alignSelf:'flex-start' }}>
      <TitlebarLeft mode="翻译" pinned={pinned} />

      <div style={{ padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>

        {/* Source card — auto-grow up to 8 lines, then scroll internally */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
          <div style={{
            maxHeight: sourceMaxBody,
            overflow: 'auto',
            padding: '12px 14px 4px'
          }}>
            <div
              contentEditable
              suppressContentEditableWarning
              style={{ fontSize: 13.5, lineHeight: '22px', color: 'var(--text)', outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {sourceText}
            </div>
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px 8px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', paddingLeft: 4 }}>
              检测为 <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>英文</span>
            </span>
            <div style={{ flex: 1 }} />
            {SOURCE_BUTTONS.map((b, i) =>
            b.kind === 'volume' ?
            <VolumeButton key={i} size={16} /> :
            <button key={i} className="ic-btn" title={b.title}>{b.icon}</button>
            )}
            <button className="ic-btn brand" title="翻译" style={{ color: 'var(--brand-primary)' }}>
              <Icons.Translate size={18} />
            </button>
          </div>
        </div>

        {/* Lang card — centered */}
        <div className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
          <LangDropdown value={srcLang} onChange={setSrcLang} codes={SOURCE_LANGS} />
          <button className="ic-btn" style={{ color: srcLang === 'auto' ? 'var(--text-mute)' : 'var(--text)', cursor: srcLang === 'auto' ? 'not-allowed' : 'pointer' }}
          title={srcLang === 'auto' ? '自动检测时无法交换' : '交换语言'}
          onClick={swapLangs} disabled={srcLang === 'auto'}>
            <Icons.Swap size={18} />
          </button>
          <LangDropdown value={dstLang} onChange={setDstLang} codes={TARGET_LANGS} />
        </div>

        {/* Results */}
        {services.map((s) =>
        <ResultCard key={s.key} s={s} r={results[s.key] || {}} />
        )}
      </div>
    </div>);

};

// ====== Dictionary window — driven by `DictResult` from one or more dict services.
//
// All dict services return the same shape (see shared/types/service.ts):
//   {
//     type: 'dict',
//     pronunciations: [{ region, phonetic }],
//     definitions:    [{ partOfSpeech, meanings: string[] }],
//     examples:       [{ source, target }],
//   }
//
// The window renders one card per service, just like the translation window
// renders one card per translation engine. Cards are independently
// collapsible / loadable / failing.

// One card per DictResult. Layout closely mirrors ResultCard in TranslateWindow:
// service tile + name in the header, chevron on the right, body expands below.
const DictResultCard = ({ s, r }) => {
  const hasResult = !!(r && (r.result || r.error));
  const isEmpty = r && r.result && r.result.definitions && r.result.definitions.length === 0;
  const [col, setCol] = useStateT(false);
  const seenRef = useRefT(false);
  useEffectT(() => {
    if (hasResult && !seenRef.current) { seenRef.current = true; setCol(false); }
  }, [hasResult]);

  const result = r && r.result;

  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.Drag size={14} style={{ color: 'var(--text-mute)', cursor: 'grab', flex: '0 0 14px' }} />
        <SvcTile name={s.name} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
        {r.loading && !r.error &&
          <span className="dots" aria-label="查询中" title="查询中…"><span /><span /><span /></span>
        }
        <div style={{ flex: 1 }} />
        {r.error &&
          <button className="ic-btn" title="重试" style={{ color: 'var(--danger)' }}>
            <Icons.Cycle size={14} />
          </button>
        }
        <button className="ic-btn" title="复制"><Icons.Copy size={16} /></button>
        <button className="ic-btn" title="收藏"><Icons.Heart size={16} /></button>
        <button className="ic-btn" title={col ? '展开' : '收起'} onClick={() => setCol((c) => !c)}>
          <Icons.Chev size={17} style={{ transform: col ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>

      {!col && (
        r.error ?
          <div style={{ marginTop: 8, marginLeft: 22, color: 'var(--danger)', fontSize: 13 }}>{r.error}</div> :
        isEmpty ?
          <div style={{ marginTop: 8, marginLeft: 22, color: 'var(--text-mute)', fontSize: 13 }}>未收录该词条</div> :
        result ?
          <DictBody result={result} /> :
          <div style={{ marginTop: 8, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="shimmer" style={{ height: 8, width: '88%' }} />
            <div className="shimmer" style={{ height: 8, width: '64%' }} />
            <div className="shimmer" style={{ height: 8, width: '76%' }} />
          </div>
      )}
    </div>
  );
};

// Renders the `pronunciations` + `definitions` + `examples` arrays of a
// DictResult. Pronunciations get their own row each, with a `朗读` button
// (TTS is supplied by a separate service — dict services never carry audio).
const DictBody = ({ result }) => {
  const allPron = result.pronunciations || [];
  const defs = result.definitions || [];
  const examples = result.examples || [];
  return (
    <div style={{ marginTop: 10, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Pronunciations — one shared row. Multiple regional variants
          (e.g. Cambridge us + uk) sit side-by-side; row wraps if it overflows.
          A speak button follows each phonetic since TTS is per-variant. */}
      {allPron.length > 0 &&
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 }}>
          {allPron.map((p, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.region &&
                <span className="chip plain mono" style={{ fontSize: 10, flex: '0 0 auto' }}>{p.region}</span>
              }
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{p.phonetic}</span>
              <VolumeButton size={14} />
            </div>
          )}
        </div>
      }

      {/* Definitions — grouped by partOfSpeech, each group lists numbered meanings. */}
      {defs.length > 0 &&
        <div className="stack" style={{ gap: 12 }}>
          {defs.map((d, i) =>
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: '0 0 auto', minWidth: 36 }}>
                {d.partOfSpeech
                  ? <span className="chip plain mono" style={{ fontSize: 10 }}>{d.partOfSpeech}</span>
                  : <span className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>{String(i+1).padStart(2,'0')}</span>}
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', flex: 1, display:'flex', flexDirection:'column', gap: 4 }}>
                {(d.meanings || []).map((m, j) =>
                  <li key={j} style={{ display:'flex', gap: 8, fontSize: 13.5, lineHeight: 1.55 }}>
                    {(d.meanings || []).length > 1 &&
                      <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)', paddingTop: 3, flex:'0 0 14px' }}>{j+1}.</span>}
                    <span style={{ flex: 1 }}>{m}</span>
                  </li>
                )}
              </ol>
            </div>
          )}
        </div>
      }

      {/* Examples — italics for en, plain for zh. We don't know the language, so always plain + monospace gutter. */}
      {examples.length > 0 &&
        <div className="stack" style={{ gap: 4, borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>
          {examples.map((ex, i) =>
            <div key={i} style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              <div>{ex.source}</div>
              {ex.target && <div style={{ color: 'var(--text-mute)', marginTop: 1 }}>{ex.target}</div>}
            </div>
          )}
        </div>
      }
    </div>
  );
};

// Source / query card at the top of the dictionary window. Matches the
// translation window's source card vocabulary (editable area + bottom action
// row) but in a more compact form because the query is usually a single word.
const DictSourceCard = ({ word, detected }) => (
  <div className="card" style={{ padding: 0 }}>
    <div style={{ padding: '12px 14px 4px' }}>
      <div contentEditable suppressContentEditableWarning
        style={{ fontSize: 18, fontWeight: 600, letterSpacing:'-0.005em', lineHeight: 1.35, outline: 'none', wordBreak:'break-word' }}>
        {word}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px 8px' }}>
      <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', paddingLeft: 4 }}>
        检测为 <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{detected}</span>
      </span>
      <div style={{ flex: 1 }} />
      <VolumeButton size={16} />
      <button className="ic-btn" title="复制单词"><Icons.Copy size={16} /></button>
      <button className="ic-btn" title="收藏"><Icons.Heart size={16} /></button>
      <button className="ic-btn brand" title="查询" style={{ color: 'var(--brand-primary)' }}>
        <Icons.Type size={16} />
      </button>
    </div>
  </div>
);

// Sample DictResults — built from the exact shapes documented in
// uploads/dict_service_test_results-0c79132e.md so the UI is honest about
// each service's strengths and limitations.
const SAMPLE_DICT_EN = {
  word: 'reconcile',
  detected: '英文',
  services: [
    { key: 'cambridge_dict', name: 'cambridge_dict', label: 'Cambridge' },
    { key: 'ecdict', name: 'ecdict', label: 'ECDict · 英→中' },
  ],
  results: {
    cambridge_dict: {
      result: {
        type: 'dict',
        pronunciations: [
          { region: 'us', phonetic: '/ˈrek.ən.saɪl/' },
          { region: 'uk', phonetic: '/ˈrek.ən.saɪl/' },
        ],
        definitions: [
          { partOfSpeech: 'verb', meanings: [
            'to find a way in which two situations or beliefs that are opposed to each other can agree and exist together.',
            'to make or show that two different ideas, beliefs, etc. can exist together or both be true.',
          ]},
          { partOfSpeech: 'verb', meanings: [
            'to begin a friendly relationship again with someone after an argument.',
            'to make yourself accept something that you do not like because you cannot easily change it.',
          ]},
        ],
        examples: [
          { source: 'It is difficult to reconcile such different points of view.', target: '' },
          { source: 'She and her father had reconciled some time before his death.', target: '' },
          { source: 'After many years, she reconciled herself to never having children.', target: '' },
        ],
      },
    },
    ecdict: {
      result: {
        type: 'dict',
        pronunciations: [],
        definitions: [
          { partOfSpeech: 'zh', meanings: [
            '调和 (tiao2 he2)',
            '使一致 (shi3 yi2 zhi4)',
            '使和解 (shi3 he2 jie3)',
            '甘愿接受 (gan1 yuan4 jie1 shou4)',
            '使顺从于 (shi3 shun4 cong2 yu2)',
          ]},
        ],
        examples: [],
      },
    },
  },
};

const SAMPLE_DICT_ZH = {
  word: '调和',
  detected: '中文',
  services: [
    { key: 'chinese_dictionary', name: 'chinese_dictionary', label: 'Chinese Dictionary' },
    { key: 'ecdict', name: 'ecdict', label: 'ECDict · 中→英' },
  ],
  results: {
    chinese_dictionary: {
      result: {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: 'tiáo hé' }],
        definitions: [
          { partOfSpeech: '动', meanings: [
            '配合得适当：色彩~。音律~。',
            '使和谐；和解（调停纠纷）：~两人的矛盾。',
            '搀和；混合：~漆。在水里~点儿白糖。',
          ]},
          { partOfSpeech: '形', meanings: [
            '配合得均匀合适：色彩~。',
          ]},
        ],
        examples: [],
      },
    },
    ecdict: {
      result: {
        type: 'dict',
        pronunciations: [{ region: '', phonetic: 'tiao2 he2' }],
        definitions: [
          { partOfSpeech: 'en', meanings: [
            'to harmonize',
            'to reconcile',
            'to placate',
            'harmonious',
            'to mix or blend',
          ]},
        ],
        examples: [],
      },
    },
  },
};

const DictWindow = ({ width = 420, height, lang = 'en' }) => {
  const data = lang === 'zh' ? SAMPLE_DICT_ZH : SAMPLE_DICT_EN;
  return (
    <div className="op-window" style={{ width, height: height || 'auto', alignSelf:'flex-start' }}>
      <TitlebarLeft mode="词典" pinned={false} />
      <div style={{ padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DictSourceCard word={data.word} detected={data.detected} />
        {data.services.map((s) =>
          <DictResultCard key={s.key} s={s} r={data.results[s.key] || {}} />
        )}
      </div>
    </div>
  );
};

Object.assign(window, { TranslateWindow, DictWindow, DictResultCard, DictSourceCard, TitlebarLeft, ReactIcon, LangDropdown, SOURCE_LANGS, TARGET_LANGS });