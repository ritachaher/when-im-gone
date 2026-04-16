import { useEffect, useState } from 'react';
import { isInitialised, lock, useVault } from './storage/vault';
import { Setup } from './ui/Setup';
import { Lock } from './ui/Lock';
import { Owner } from './ui/Owner';
import { Survivor } from './ui/Survivor';

type Screen = 'boot' | 'setup' | 'lock' | 'owner' | 'survivor';

export function App() {
  const unlocked = useVault((s) => s.unlocked);
  const [screen, setScreen] = useState<Screen>('boot');

  useEffect(() => {
    (async () => {
      const hasJournal = await isInitialised();
      setScreen(hasJournal ? 'lock' : 'setup');
    })();
  }, []);

  useEffect(() => {
    if (unlocked && screen === 'lock') setScreen('owner');
  }, [unlocked]);

  if (screen === 'boot') return <div className="centre muted">Loading…</div>;

  if (screen === 'setup') return <Setup onDone={() => setScreen('owner')} />;

  if (screen === 'lock')
    return <Lock onSurvivor={() => setScreen('survivor')} />;

  if (screen === 'owner')
    return (
      <Owner
        onLock={() => {
          lock();
          setScreen('lock');
        }}
      />
    );

  if (screen === 'survivor')
    return <Survivor onBack={() => setScreen('lock')} />;

  return null;
}
