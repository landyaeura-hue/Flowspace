import { useCallback, useEffect, useState } from 'react';
import { useCloud, setCloud } from '../cloud/store';
import type { Person, ShareLink } from '../cloud/backend';
import { afterLeave, backendRef, currentUser, ensureOnServer, roleOfCanvas } from '../cloud/sync';
import { colorFor } from '../collab/session';
import { toB64 } from '../collab/binding';
import { STATE } from '../engine/state';
import { closeMenus } from '../engine/chrome';
import { toast } from '../engine/help';
import { currentCanvasId } from '../engine/storage';

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
const initial = (email: string) => (email[0] || '?').toUpperCase();
const linkUrl = (token: string) => `${window.location.origin}${window.location.pathname}?join=${token}`;
function newToken() { const a = new Uint8Array(18); crypto.getRandomValues(a); return toB64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Link copied'); }
  catch { window.prompt('Copy this link', text); }
}

/** "Share canvas…" at the top of the Share menu (cloud builds only). */
export function ShareMenuItem() {
  const enabled = useCloud(s => s.enabled);
  if (!enabled) return null;
  return <>
    <button id="bShareCanvas" onClick={() => { closeMenus(); setCloud({ share: true }); }}>Invite people…<small>link</small></button>
    <hr />
  </>;
}

/** Avatars of the people on this canvas right now, plus a view-only badge. */
export function PeersBar() {
  const { peers, live, liveRole, user } = useCloud();
  if (!user || live === 'off') return null;
  const others = peers.filter(p => p.uid !== user.id);
  return <div className="peers-bar">
    {liveRole === 'viewer' && <span className="ro-badge" title="You can look around but not change this canvas">View only</span>}
    {others.slice(0, 4).map(p => <i key={p.uid} className="pav" style={{ background: p.color }} title={`${p.email}${p.role === 'viewer' ? ' (viewing)' : ''}`}>{initial(p.email)}</i>)}
    {others.length > 4 && <i className="pav more" title={others.slice(4).map(p => p.email).join('\n')}>+{others.length - 4}</i>}
    {live === 'connecting' && <span className="live-dot off" title="Connecting to live editing…" />}
    {(others.length > 0 || live === 'connecting') && <div className="sep" />}
  </div>;
}

export function ShareDialog() {
  const { share, user } = useCloud();
  if (!share) return null;
  return <ShareBody signedIn={!!user} />;
}

function ShareBody({ signedIn }: { signedIn: boolean }) {
  const close = () => setCloud({ share: false });
  const id = currentCanvasId() || '';
  const me = currentUser();
  const role = signedIn ? roleOfCanvas(id) : null;
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const be = backendRef();
    const [p, l] = await Promise.all([be.people(id), role === 'owner' ? be.links(id) : Promise.resolve([])]);
    setPeople(p); setLinks(l);
  }, [id, role]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    (async () => {
      try {
        if (!(await ensureOnServer(id))) throw new Error('This canvas hasn’t reached the server yet — check your connection and try again.');
        await load();
      } catch (e: any) { if (live) setErr(e?.kind === 'network' ? 'Can’t reach the server. Check your connection.' : String(e?.message || e)); }
      finally { if (live) setReady(true); }
    })();
    return () => { live = false; };
  }, [signedIn, id, load]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr('');
    try { await fn(); await load(); } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(''); }
  };

  const title = `Share “${STATE.doc ? STATE.doc.name : ''}”`;
  const shell = (body: React.ReactNode) => <div className="modal" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close(); }} onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="card share" role="dialog" aria-label={title} onClick={stop}>
      <h3>{title}<button className="ib" title="Close" onClick={close}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button></h3>
      {body}
    </div>
  </div>;

  if (!signedIn) return shell(<>
    <p className="note big">Sign in to invite people. Everyone you invite edits the same canvas with you in real time.</p>
    <div className="row"><button className="tb" onClick={close}>Cancel</button><button className="tb pri" onClick={() => setCloud({ share: false, dialog: 'signin' })}>Sign in</button></div>
  </>);

  const owner = role === 'owner';
  const linkRow = (r: 'editor' | 'viewer') => {
    const l = links.find(x => x.role === r), label = r === 'editor' ? 'Can edit' : 'Can view';
    return <div className="lrow" key={r} data-role={r}>
      <div className="lh"><b>{label}</b><span>{l ? 'Anyone with this link who signs in' : 'Off'}</span></div>
      {l ? <div className="lctl">
        <input readOnly value={linkUrl(l.token)} onFocus={e => e.currentTarget.select()} />
        <button className="tb pri" data-copy={r} onClick={() => copy(linkUrl(l.token))}>Copy</button>
        <button className="tb" disabled={!!busy} onClick={() => act('off' + r, () => backendRef().deleteLink(id, r))}>Turn off</button>
      </div> : <button className="tb" data-create={r} disabled={!!busy} onClick={() => act('on' + r, async () => { await backendRef().createLink(id, r, newToken()); })}>{busy === 'on' + r ? 'Creating…' : 'Create link'}</button>}
    </div>;
  };

  return shell(<>
    {!ready ? <p className="note">Loading…</p> : <>
      {owner ? <>
        <h4>Invite with a link</h4>
        {linkRow('editor')}
        {linkRow('viewer')}
        <p className="note">People need a FlowSpace account. Turning a link off stops new people from joining with it; people already here stay until you remove them.</p>
      </> : <p className="note">Only the owner can invite people or change access.</p>}
      <h4>People with access</h4>
      <ul className="people">
        {people.map(p => <li key={p.user_id}>
          <i className="pav" style={{ background: colorFor(p.user_id) }}>{initial(p.email)}</i>
          <span className="em">{p.email}{me && p.user_id === me.id ? ' (you)' : ''}</span>
          {p.role === 'owner' ? <span className="rl">Owner</span> : owner ? <>
            <select value={p.role} disabled={!!busy} onChange={e => { const v = e.target.value as 'editor' | 'viewer'; act('role', () => backendRef().setRole(id, p.user_id, v)); }}>
              <option value="editor">Can edit</option><option value="viewer">Can view</option>
            </select>
            <button className="ib x" title="Remove" disabled={!!busy} onClick={() => act('rm', () => backendRef().removeMember(id, p.user_id))}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </> : <span className="rl">{p.role === 'editor' ? 'Can edit' : 'Can view'}</span>}
        </li>)}
      </ul>
      {!owner && <div className="row left"><button className="tb danger" onClick={() => act('leave', async () => { if (me) await backendRef().removeMember(id, me.id); close(); afterLeave(id); })}>Leave this canvas</button></div>}
    </>}
    {err && <p className="err">{err}</p>}
  </>);
}
