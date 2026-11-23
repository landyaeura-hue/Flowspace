import { memo } from 'react';

/**
 * Static chrome of the editor (toolbars, menus, panels, canvas SVG).
 * The canvas engine (src/engine) attaches to these elements by id after mount and
 * manages them imperatively, so this component must render once and never re-render.
 */
export const Shell = memo(function Shell() {
  return (
    <div id="app" className="bg-blue t-select">
        <svg id="cv" xmlns="http://www.w3.org/2000/svg" tabIndex={-1}>
          <defs id="defs"></defs>
          <g id="world"><g id="edges"></g><g id="nodes"></g><g id="ghosts"></g><g id="inks"></g><g id="texts"></g><g id="ui"></g></g>
        </svg>
        <div id="edwrap"><div id="ed" spellCheck={false}></div></div>
        <div id="hint"><b>A clean canvas</b>Pick a shape on the left, or press T to add text</div>
      
        <div id="top-l" className="float">
          <div className="logo"><i><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#344766" strokeWidth="1.5" strokeLinecap="round"><rect x="1.5" y="2" width="6" height="4.5" rx="1.6"/><rect x="8.5" y="9.5" width="6" height="4.5" rx="1.6"/><path d="M4.5 6.5v3a2 2 0 002 2h2"/></svg></i><b>FlowSpace</b></div>
          <div className="sep"></div>
          <input id="fname" defaultValue="Untitled canvas" aria-label="File name" />
          <button className="ib narrow" id="bFiles" title="My canvases" style={{ marginLeft: '-8px' }}><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
          <div id="status"><span>Saved locally</span></div>
        </div>
      
        <div id="top-r" className="float">
          <button className="ib" id="undo" title="Undo (Ctrl+Z)"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg></button>
          <button className="ib" id="redo" title="Redo (Ctrl+Shift+Z)"><svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/></svg></button>
          <div className="sep"></div>
          <button className="tb" id="bExport"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg><span className="tx">Export</span></button>
          <button className="tb pri" id="bShare"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg><span className="tx">Share</span></button>
        </div>
        <div className="menu float" id="mExport" style={{ right: '96px', width: '232px' }}>
          <button data-m="png">Export PNG<small>2× resolution</small></button>
          <button data-m="svg">Export SVG<small>Vector</small></button>
          <hr />
          <div className="tg xo" data-xo="sel"><span>Selection only</span><i></i></div>
          <div className="tg xo" data-xo="transparent"><span>Transparent background</span><i></i></div>
        </div>
        <div className="menu float" id="mFiles"></div>
        <div className="menu float" id="ctx"></div>
        <div className="menu float" id="mShare" style={{ right: '14px' }}>
          <button data-m="json">Export canvas file<small>.json</small></button>
          <button data-m="import">Import canvas file<small>as new canvas</small></button>
          <hr />
          <button data-m="new">New canvas<small>Alt N</small></button>
        </div>
        <input type="file" id="fileIn" accept=".json,application/json" hidden />
      
        <div id="tools" className="float">
          <button className="ib on" data-tool="select" data-tip="Select  V"><svg viewBox="0 0 24 24"><path d="M6 4l12.5 7.2-5.6 1.4-2.4 5.4z"/></svg></button>
          <button className="ib" data-tool="hand" data-tip="Hand  H / hold Space"><svg viewBox="0 0 24 24"><path d="M8 12.5V6.8a1.5 1.5 0 013 0V11m0-5.7a1.5 1.5 0 013 0V11m0-4a1.5 1.5 0 013 0v6.5c0 4-2.6 6.5-6.2 6.5-2.6 0-4.2-1.2-5.6-3.6l-1.8-3.2a1.5 1.5 0 012.5-1.6L8 13"/></svg></button>
          <div className="sep"></div>
          <button className="ib" data-tool="rect" data-tip="Rectangle  1"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/></svg></button>
          <button className="ib" data-tool="roundrect" data-tip="Rounded rectangle  2"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="4"/></svg></button>
          <button className="ib" data-tool="circle" data-tip="Circle  3"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/></svg></button>
          <button className="ib" data-tool="diamond" data-tip="Diamond  4"><svg viewBox="0 0 24 24"><path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/></svg></button>
          <button className="ib" data-tool="capsule" data-tip="Pill  5"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/></svg></button>
          <div className="sep"></div>
          <button className="ib" data-tool="conn" data-tip="Connector  L"><svg viewBox="0 0 24 24"><path d="M4 18h4a3 3 0 003-3V9a3 3 0 013-3h5"/><path d="M16.5 3.5L19 6l-2.5 2.5"/></svg></button>
          <button className="ib" data-tool="text" data-tip="Text  T"><svg viewBox="0 0 24 24"><path d="M6 6h12M12 6v13M9.5 19h5"/></svg></button>
          <button className="ib" data-tool="lasso" data-tip="Lasso select  Q"><svg viewBox="0 0 24 24"><path d="M7.5 15.5C4.8 14.4 3.5 12.6 3.5 10.6 3.5 6.9 7.6 4 12.6 4s8.9 2.9 8.9 6.6-4 6.6-9 6.6c-1.2 0-2.3-.1-3.3-.4" strokeDasharray="2.6 2.4"/><path d="M8.6 16.2c-.5 1.6.1 3.1 1.7 3.8"/><circle cx="8.3" cy="16.4" r="1.6"/></svg></button>
          <button className="ib" data-tool="pen" data-tip="Pen  B"><svg viewBox="0 0 24 24"><path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5z"/><path d="M14 6.8l3.2 3.2"/><path d="M4 21c3-1.2 5-.4 7 .2s4 .2 6-1"/></svg></button>
        </div>
      
        <div id="panel" className="float"></div>
      
        <div id="view" className="float">
          <button className="ib" id="zOut" title="Zoom out"><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button>
          <button id="zoomv" title="Reset to 100%">100%</button>
          <button className="ib" id="zIn" title="Zoom in"><svg viewBox="0 0 24 24"><path d="M6 12h12M12 6v12"/></svg></button>
          <div className="sep"></div>
          <button className="ib" id="fit" title="Fit to screen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
          <div className="sep"></div>
          <button className="ib" id="bPhys" title="Physics on/off  P"><svg viewBox="0 0 24 24"><rect x="2.5" y="8" width="7.5" height="8" rx="2.5"/><rect x="14" y="8" width="7.5" height="8" rx="2.5"/><path d="M12 6.5v11" strokeDasharray="1.5 2.2"/></svg></button>
          <button className="ib narrow" id="bPhysSet" title="Physics settings"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
          <button className="ib" id="bLayout" title="Auto layout"><svg viewBox="0 0 24 24"><rect x="2.5" y="9.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="3.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="15.5" width="6" height="5" rx="1.5"/><path d="M8.5 12H12M12 6v12M12 6h3.5M12 18h3.5"/></svg></button>
          <div className="sep"></div>
          <div className="bgsw" title="Canvas background"><button data-bg="blue" title="Tinted background" aria-label="Tinted background"></button><button data-bg="white" style={{ background: '#fff' }} title="White background" aria-label="White background"></button><button data-bg="dark" title="Night background" aria-label="Night background"></button></div>
          <button className="ib" id="bTheme" title="Color theme"><svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.9-1.6h1.8a4.2 4.2 0 004.2-4.2C20.5 6.4 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11.2" r="1.1"/><circle cx="10.2" cy="7.4" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/></svg></button>
        </div>
        <button id="keys" className="float">Double-click to edit · Scroll or pinch to zoom · Space + drag to pan · <b>? Shortcuts</b></button>
        <div className="pop float" id="pPhys"></div>
        <div className="pop float" id="pTheme"></div>
        <div className="menu float" id="mLayout" style={{ top: 'auto', bottom: '66px', right: '14px', width: '236px' }}>
          <button data-lay="LR">Left to right<small>layered by links</small></button>
          <button data-lay="TB">Top to bottom<small>layered by links</small></button>
          <hr /><p className="note" style={{ padding: '0 10px 6px', margin: 0 }}>With 2+ nodes selected, only the selection is arranged. Text boxes and locked nodes stay put.</p>
        </div>
        <div id="help"><div className="card"><h3>Keyboard shortcuts<button className="ib" id="helpX" title="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></h3><div className="kgrid" id="kgrid"></div></div></div>
        <div id="toast"></div>
    </div>
  );
}, () => true);
