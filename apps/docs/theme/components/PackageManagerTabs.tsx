import { useId, useState } from 'react';

type Variant = 'help' | 'init';
type PackageManager = 'pnpm' | 'npm' | 'yarn';

const COMMANDS: Record<Variant, Record<PackageManager, string>> = {
  help: {
    pnpm: `pnpm add -D docplaybook
pnpm exec docplaybook --help`,
    npm: `npm install --save-dev docplaybook
npx docplaybook --help`,
    yarn: `yarn add -D docplaybook
yarn exec docplaybook --help`
  },
  init: {
    pnpm: `pnpm add -D docplaybook
pnpm exec docplaybook init .`,
    npm: `npm install --save-dev docplaybook
npx docplaybook init .`,
    yarn: `yarn add -D docplaybook
yarn exec docplaybook init .`
  }
};

const ORDER: PackageManager[] = ['pnpm', 'npm', 'yarn'];

export default function PackageManagerTabs({ variant }: { variant: Variant }) {
  const groupId = useId();
  const [activeTab, setActiveTab] = useState<PackageManager>('pnpm');

  return (
    <div className="dp-pm-tabs">
      <div className="dp-pm-tabs-list" role="tablist" aria-label="Package managers">
        {ORDER.map((manager) => {
          const tabId = `${groupId}-${manager}-tab`;
          const panelId = `${groupId}-${manager}-panel`;
          const isActive = activeTab === manager;

          return (
            <button
              key={manager}
              id={tabId}
              className={`dp-pm-tab${isActive ? ' is-active' : ''}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={panelId}
              onClick={() => setActiveTab(manager)}
            >
              {manager}
            </button>
          );
        })}
      </div>

      {ORDER.map((manager) => {
        const panelId = `${groupId}-${manager}-panel`;
        const tabId = `${groupId}-${manager}-tab`;
        const isActive = activeTab === manager;

        return (
          <div
            key={manager}
            id={panelId}
            className={`dp-pm-panel${isActive ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby={tabId}
            hidden={!isActive}
          >
            <pre><code>{COMMANDS[variant][manager]}</code></pre>
          </div>
        );
      })}
    </div>
  );
}
