/* global React, Switch, Select, LangSelect, Flag, SvcTile, Icons, LANG_NAME, LANG_LABEL */
const { useState: useStateT } = React;

// Plain titlebar — pin LEFT, then wordmark, then mode label, spacer, close
const TitlebarLeft = ({ mode = '翻译', pinned: pinnedProp = false }) => {
  const [pinned, setPinned] = useStateT(!!pinnedProp);
  return (
    <div className="op-titlebar">
      <button className="op-pin" title={pinned ? '取消置顶' : '置顶'}
        onClick={() => setPinned(p => !p)}
        style={{
          width: 28, height: 28, borderRadius: 6, display:'grid', placeItems:'center',
          color: pinned ? 'var(--brand-primary)' : 'var(--text-mute)',
          background: 'transparent',
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
        }}>
        <Icons.Pin size={18} fill={pinned} />
      </button>
      <div className="op-wordmark" style={{ marginLeft: 2 }}>
        Omni Pot
      </div>
      <span className="op-mode">{mode}</span>
      <div className="spacer" />
      <button className="op-close" title="关闭"
        style={{
          width: 28, height: 28, borderRadius: 6, display:'grid', placeItems:'center',
          color: 'var(--text-mute)',
          background: 'transparent',
          WebkitAppRegion: 'no-drag',
        }}>
        <Icons.Close size={18} />
      </button>
    </div>
  );
};

// Inline lang switch — bigger text, no flag prefix
const LangPick = ({ label }) => (
  <button style={{
    height: 28, padding: '0 6px',
    background: 'transparent', border: 0, color: 'var(--text)',
    fontSize: 13.5, fontWeight: 500,
    display:'inline-flex', alignItems:'center', gap: 4,
    cursor:'pointer',
  }}>
    {label}
    <Icons.Chev size={12} style={{ color:'var(--text-mute)', marginTop: 1 }}/>
  </button>
);

const SOURCE_BUTTONS = [
  { icon: <Icons.Newline size={16}/>, title:'去除换行' },
  { icon: <Icons.Volume size={16}/>, title:'朗读' },
  { icon: <Icons.Copy size={16}/>, title:'复制原文' },
  { icon: <Icons.Trash size={16}/>, title:'清空' },
];

const svcLabel = (name) => (window.SVC_META[name] || {}).name || name;

// ResultCard — actions all in top-right row
const ResultCard = ({ s, r }) => {
  const [col, setCol] = useStateT(false);
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <SvcTile name={s.name} />
        <div style={{ fontSize: 13, fontWeight: 600, color:'var(--text)' }}>{svcLabel(s.name)}</div>
        {s.streaming && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize: 10.5, fontFamily:'var(--font-mono)', color:'var(--text-mute)' }}>
            <span style={{ display:'inline-block', width:6, height:6, borderRadius:99, background:'var(--brand-primary)' }}/>
            stream
          </span>
        )}
        {r.loading && (
          <span style={{ fontSize: 11, color:'var(--text-mute)', fontFamily:'var(--font-mono)' }}>翻译中…</span>
        )}
        <div style={{ flex:1 }} />
        <button className="ic-btn" title="朗读"><Icons.Volume size={16}/></button>
        <button className="ic-btn" title="复制"><Icons.Copy size={16}/></button>
        <button className="ic-btn" title="收藏"><Icons.Heart size={16}/></button>
        <button className="ic-btn" title={col?'展开':'收起'} onClick={()=>setCol(c=>!c)}>
          <Icons.Chev size={17} style={{ transform: col ? 'rotate(-90deg)' : 'none', transition:'transform .15s' }}/>
        </button>
      </div>

      {!col && (
        r.error ? (
          <div style={{ marginTop: 8, color:'var(--danger)', fontSize: 13 }}>{r.error}</div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.6, color:'var(--text)' }}>
            {r.text || (r.loading ? <span style={{color:'var(--text-mute)'}}>…</span> : <span style={{color:'var(--text-mute)'}}>等待翻译</span>)}
          </div>
        )
      )}
    </div>
  );
};

const TranslateWindow = ({ width = 400, height, sourceText, services, results, pinned = true }) => {
  // Source textarea auto-grows up to ~8 lines (line-height 1.6 * 13.5px ≈ 21.6px)
  // Action row + padding adds ≈64px; we cap the *card* total height accordingly.
  const SOURCE_MAX_LINES = 8;
  const LH = 22; // px per line
  const sourceMaxBody = SOURCE_MAX_LINES * LH;     // body region max
  return (
    <div className="op-window" style={{ width, height: height || '100%' }}>
      <TitlebarLeft mode="翻译" pinned={pinned} />

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px 12px', display:'flex', flexDirection:'column', gap: 8, minHeight: 0 }}>

        {/* Source card — auto-grow up to 8 lines, then scroll internally */}
        <div className="card" style={{ padding: 0, display:'flex', flexDirection:'column', flex:'0 0 auto' }}>
          <div style={{
            maxHeight: sourceMaxBody,
            overflow: 'auto',
            padding: '12px 14px 4px',
          }}>
            <div
              contentEditable
              suppressContentEditableWarning
              style={{ fontSize: 13.5, lineHeight: '22px', color:'var(--text)', outline:'none', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              {sourceText}
            </div>
          </div>
          <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap: 4, padding: '6px 10px 8px' }}>
            <span style={{ fontSize: 12, color:'var(--text-mute)', fontFamily:'var(--font-mono)', paddingLeft: 4 }}>
              检测为 <span style={{ color:'var(--brand-primary)', fontWeight: 600 }}>英文</span>
            </span>
            <div style={{ flex:1 }} />
            {SOURCE_BUTTONS.map((b, i) => (
              <button key={i} className="ic-btn" title={b.title}>{b.icon}</button>
            ))}
            <button className="ic-btn brand" title="翻译" style={{ color:'var(--brand-primary)' }}>
              <Icons.Translate size={18}/>
            </button>
          </div>
        </div>

        {/* Lang card — centered */}
        <div className="card" style={{ padding: '4px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap: 10, flex:'0 0 auto' }}>
          <LangPick label="自动检测"/>
          <button className="ic-btn" style={{ color:'var(--text)' }} title="交换语言">
            <Icons.Swap size={18}/>
          </button>
          <LangPick label="简体中文"/>
        </div>

        {/* Results */}
        {services.map(s => (
          <ResultCard key={s.key} s={s} r={results[s.key] || {}} />
        ))}
      </div>
    </div>
  );
};

// ====== Dictionary window — no search, no newline icon, favorite on the word ======
const DictWindow = ({ width = 420, height }) => {
  return (
    <div className="op-window" style={{ width, height: height || '100%' }}>
      <TitlebarLeft mode="词典" pinned={false} />
      <div style={{ flex:1, overflow:'auto', padding: '4px 12px 14px', display:'flex', flexDirection:'column', gap: 10 }}>

        {/* Word header card */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap: 10 }}>
            <div style={{ flex:1, minWidth: 0 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap: 10, flexWrap:'wrap' }}>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>reconcile</div>
                <button className="ic-btn" title="朗读"><Icons.Volume size={16}/></button>
                <div className="mono" style={{ color:'var(--text-mute)', fontSize: 12.5 }}>/ˈrek.ən.saɪl/</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginTop: 6 }}>
                <span className="chip plain mono" style={{ fontSize: 10 }}>v.</span>
                <span className="chip plain mono" style={{ fontSize: 10 }}>CEFR · C1</span>
              </div>
            </div>
            <button className="ic-btn brand" title="收藏单词" style={{ color:'var(--brand-primary)' }}>
              <Icons.Heart size={18}/>
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 10 }}>释义</div>
          <div className="stack" style={{ gap: 12 }}>
            {[
              { pos: 'vt.', def: '使一致；使协调', en: 'to make consistent or compatible' },
              { pos: 'vt.', def: '使和解；调解', en: 'to restore friendly relations between' },
              { pos: 'vi.', def: '甘心于；顺从', en: 'to accept as inevitable' },
            ].map((d, i) => (
              <div key={i} style={{ display:'flex', gap: 10 }}>
                <div style={{ width: 22, color:'var(--text-mute)', fontFamily:'var(--font-mono)', fontSize: 11, paddingTop: 3 }}>{String(i+1).padStart(2,'0')}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span className="chip plain mono" style={{ fontSize: 10 }}>{d.pos}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{d.def}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginTop: 3, fontStyle:'italic' }}>{d.en}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 8 }}>例句</div>
          <div className="stack gap-10">
            {[
              ['It is hard to reconcile the demands of work and family.', '很难协调工作和家庭的要求。'],
              ['She finally reconciled herself to a life of poverty.', '她终于安于贫困的生活。'],
            ].map(([s, t], i) => (
              <div key={i} style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>{s}</div>
                <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginTop: 2 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '10px 14px' }}>
          <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 8 }}>词形变化</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
            {['reconciled','reconciles','reconciling','reconciliation','reconcilable'].map(w => (
              <span key={w} className="chip plain mono" style={{ fontSize: 11 }}>{w}</span>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap: 6, padding: '4px 4px 0' }}>
          <span className="hint mono">来源</span>
          <span className="chip plain mono" style={{ fontSize: 10 }}>Free Dictionary</span>
          <span className="chip plain mono" style={{ fontSize: 10 }}>ECDict</span>
          <span className="chip plain mono" style={{ fontSize: 10 }}>Cambridge</span>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { TranslateWindow, DictWindow, TitlebarLeft });
