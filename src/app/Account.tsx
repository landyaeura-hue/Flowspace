import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useCloud, setCloud, openDialog, type Dialog } from '../cloud/store';
import { backend } from '../cloud';
import { flush, pendingUploads, resolveConflict, signOut, unsyncedCount, uploadLocal } from '../cloud/sync';

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

/** Account button in the top-right toolbar (hidden when no cloud backend is configured). */
export function AccountButton() {
  const { enabled, ready, user, uploadable, sync, syncError } = useCloud();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmOut(0); } };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [open]);
  if (!enabled) return null;
  if (!user) {
    return <button className="tb" id="bSignIn" disabled={!ready} onClick={() => openDialog('signin')}>
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" /></svg><span className="tx">Sign in</span>
    </button>;
  }
  const doSignOut = async () => {
    await flush();
    const n = unsyncedCount();
    if (n && confirmOut !== n) { setConfirmOut(n); return; }
    setOpen(false); setConfirmOut(0); await signOut();
  };
  const syncLine = sync === 'saving' ? 'Saving…' : sync === 'offline' ? 'Offline — changes are kept on this device' : sync === 'error' ? 'Not synced: ' + syncError : sync === 'conflict' ? 'Sync conflict — choose a version' : 'All changes saved to your account';
  return <div className="acct" ref={ref}>
    <button className="avatar" id="bAccount" title={user.email} onClick={() => setOpen(o => !o)}>{(user.email[0] || '?').toUpperCase()}</button>
    {open && <div className="acct-menu float" onKeyDown={stop}>
      <div className="mh"><b>{user.email}</b></div>
      <p className={'acct-sync s-' + sync}>{syncLine}</p>
      <hr />
      {uploadable > 0 && <button onClick={() => { setOpen(false); openDialog('upload'); }}>Upload {uploadable} canvas{uploadable > 1 ? 'es' : ''} from this browser</button>}
      <button onClick={() => { setOpen(false); openDialog('newpw'); }}>Change password</button>
      {confirmOut > 0 && <p className="acct-warn">{confirmOut} canvas{confirmOut > 1 ? 'es have' : ' has'} changes that haven’t reached the server yet. Signing out discards them on this device.</p>}
      <button id="bSignOut" className={confirmOut ? 'danger' : ''} onClick={doSignOut}>{confirmOut ? 'Sign out anyway' : 'Sign out'}</button>
    </div>}
  </div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="card" role="dialog" aria-label={title}>
      <h3>{title}<button className="ib" title="Close" onClick={onClose}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button></h3>
      {children}
    </div>
  </div>;
}

const TITLES: Record<Exclude<Dialog, null>, string> = {
  signin: 'Sign in to FlowSpace', signup: 'Create your account', magic: 'Email me a sign-in link',
  reset: 'Reset your password', newpw: 'Set a new password', upload: 'Upload canvases to your account',
};

/** Sign-in / sign-up / password dialogs, the upload offer and the sync-conflict prompt. */
export function CloudDialogs() {
  const { dialog, conflict } = useCloud();
  return <>
    {dialog && <DialogBody key={dialog} kind={dialog} />}
    {conflict && <div className="conflict float" onKeyDown={stop}>
      <div><b>“{conflict.name}” was changed on another device.</b><span>Which version do you want to keep?</span></div>
      <button className="tb" onClick={() => resolveConflict('theirs')}>Use latest</button>
      <button className="tb" onClick={() => resolveConflict('mine')}>Keep mine</button>
      <button className="tb pri" onClick={() => resolveConflict('both')}>Keep both</button>
    </div>}
  </>;
}

function DialogBody({ kind }: { kind: Exclude<Dialog, null> }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const close = () => setCloud({ dialog: null });
  const go = (d: Dialog) => setCloud({ dialog: d });
  const run = async (e: FormEvent, fn: () => Promise<string | void>) => {
    e.preventDefault(); if (busy) return; setBusy(true); setErr('');
    try { const msg = await fn(); if (msg) setDone(msg); else close(); }
    catch (x: any) { setErr(x?.kind === 'network' ? 'Can’t reach the server. Check your connection and try again.' : String(x?.message || x)); }
    finally { setBusy(false); }
  };
  const be = backend!;
  const title = TITLES[kind];

  if (kind === 'upload') {
    const items = pendingUploads();
    return <Modal title={title} onClose={close}>
      <p className="note">{items.length ? `These ${items.length} canvas${items.length > 1 ? 'es are' : ' is'} stored only in this browser. Upload a copy to your account to open ${items.length > 1 ? 'them' : 'it'} on any device. The originals stay here.` : 'Everything in this browser is already in your account.'}</p>
      <ul className="uplist">{items.slice(0, 8).map(x => <li key={x.id}>{x.name}</li>)}{items.length > 8 && <li>… and {items.length - 8} more</li>}</ul>
      <div className="row">
        <button className="tb" onClick={close}>Not now</button>
        {items.length > 0 && <button className="tb pri" id="bUpload" onClick={() => { uploadLocal(); close(); }}>Upload {items.length}</button>}
      </div>
    </Modal>;
  }

  if (done) return <Modal title={title} onClose={close}><p className="note big">{done}</p><div className="row"><button className="tb pri" onClick={close}>OK</button></div></Modal>;

  const emailIn = <label>Email<input type="email" autoComplete="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} /></label>;
  const errP = err && <p className="err">{err}</p>;

  if (kind === 'signin') return <Modal title={title} onClose={close}>
    {useCloud.getState().joinPending && <p className="note big join">Sign in or create an account to open the canvas that was shared with you.</p>}
    <form onSubmit={e => run(e, () => be.signIn(email.trim(), pw))}>
      {emailIn}
      <label>Password<input type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></label>
      {errP}
      <button className="tb pri wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <div className="links"><button onClick={() => go('magic')}>Email me a link instead</button><button onClick={() => go('reset')}>Forgot password?</button></div>
    <p className="note center">New to FlowSpace? <button className="lnk" onClick={() => go('signup')}>Create an account</button></p>
  </Modal>;

  if (kind === 'signup') return <Modal title={title} onClose={close}>
    <form onSubmit={e => run(e, async () => (await be.signUp(email.trim(), pw)) === 'confirm' ? `We sent a confirmation link to ${email.trim()}. Open it on this device to finish creating your account.` : undefined)}>
      {emailIn}
      <label>Password<input type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} /><small>At least 8 characters</small></label>
      {errP}
      <button className="tb pri wide" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    </form>
    <p className="note center">Already have an account? <button className="lnk" onClick={() => go('signin')}>Sign in</button></p>
  </Modal>;

  if (kind === 'magic' || kind === 'reset') return <Modal title={title} onClose={close}>
    <form onSubmit={e => run(e, async () => {
      if (kind === 'magic') { await be.sendMagicLink(email.trim()); return `Check ${email.trim()} — the link signs you in (it also creates an account if you don’t have one).`; }
      await be.resetPassword(email.trim()); return `If ${email.trim()} has an account, a link to set a new password is on its way.`;
    })}>
      {emailIn}
      {errP}
      <button className="tb pri wide" disabled={busy}>{busy ? 'Sending…' : 'Send link'}</button>
    </form>
    <p className="note center"><button className="lnk" onClick={() => go('signin')}>Back to sign in</button></p>
  </Modal>;

  // newpw
  return <Modal title={title} onClose={close}>
    <form onSubmit={e => run(e, async () => { await be.updatePassword(pw); return 'Your password has been changed.'; })}>
      <label>New password<input type="password" autoComplete="new-password" required minLength={8} autoFocus value={pw} onChange={e => setPw(e.target.value)} /><small>At least 8 characters</small></label>
      {errP}
      <button className="tb pri wide" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  </Modal>;
}
