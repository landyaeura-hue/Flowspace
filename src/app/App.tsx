import { useEffect } from 'react';
import { Shell } from './Shell';
import { mountEngine } from '../engine';

export function App() {
  useEffect(() => { mountEngine(); }, []);
  return <Shell />;
}
