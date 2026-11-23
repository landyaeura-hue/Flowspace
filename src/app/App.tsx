import { useEffect } from 'react';
import { Shell } from './Shell';
import { mountEngine } from '../engine';
import { backend } from '../cloud';
import { initSync, preselectSpace } from '../cloud/sync';
import { setCloud } from '../cloud/store';
import { mockControl, mockEditElsewhere } from '../cloud/mock-backend';

let started = false;

export function App() {
  useEffect(() => {
    if (started) return;
    started = true;
    if (backend) { setCloud({ enabled: true }); preselectSpace(); }
    mountEngine();
    if (backend) {
      initSync(backend);
      if (backend.name === 'mock') Object.assign(window, { __mockcloud: { control: mockControl, editElsewhere: mockEditElsewhere } });
    }
  }, []);
  return <Shell />;
}
