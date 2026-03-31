import { useEffect, useState } from 'react';
import { HomeFooter, HomeHero } from '@rspress/core/theme-original';

export * from '@rspress/core/theme-original';

function FrameworkBadges() {
  const frameworks = [
    {
      name: 'Rspress',
      logo: '/framework-rspress.svg'
    },
    {
      name: 'Docusaurus',
      logo: '/framework-docusaurus.svg'
    },
    {
      name: 'VitePress',
      logo: '/framework-vitepress.svg'
    }
  ] as const;

  return (
    <div className="dp-nav-frameworks" aria-label="Supported frameworks">
      {frameworks.map((framework) => (
        <a
          key={framework.name}
          className="dp-nav-framework"
          href="/guide/quick-start"
          title={`Works with ${framework.name}`}
        >
          <img src={framework.logo} alt={framework.name} />
          <span>{framework.name}</span>
        </a>
      ))}
    </div>
  );
}

function HomeShowcase() {
  const showcaseItems = [
    {
      title: 'Translate',
      description: 'Translate only changed content and keep the rest stable.'
    },
    {
      title: 'Learn',
      description: 'Turn review edits into reusable memory.'
    },
    {
      title: 'Lint',
      description: 'Flag translation issues with fixable findings.'
    }
  ] as const;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % showcaseItems.length);
    }, 15_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, showcaseItems.length]);

  return (
    <section className="dp-home-section">
      <div className="dp-home-section-head">
        <span className="dp-home-eyebrow">Core Workflow</span>
        <h2 className="dp-home-section-title">Translate, learn, and lint in one steady loop.</h2>
        <p className="dp-home-section-copy">
          DocPlaybook keeps translation work grounded in source baselines, language memory, and lint-style
          review so multilingual docs stay stable as they evolve.
        </p>
      </div>

      <div className="dp-showcase">
        <div className="dp-showcase-rail">
          {showcaseItems.map((item, index) => (
            <button
              key={item.title}
              type="button"
              className={`dp-showcase-item${activeIndex === index ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </button>
          ))}
        </div>

        <div className="dp-showcase-stage">
          <div className={`dp-demo${activeIndex === 0 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>translate</span>
              <span>README.md -&gt; README.ja.md</span>
            </div>
            <div className="dp-demo-body dp-demo-body-translate">
              <div className="dp-translate-compare">
                <div className="dp-translate-pane">
                  <div className="dp-translate-pane-head">Source (English)</div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p># DocPlaybook overview</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-changed">
                    <div className="dp-translate-label">changed</div>
                    <p>Supports baseline-aware translation for changed blocks only.</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p>Unchanged sections are kept from the existing target file.</p>
                  </div>
                </div>
                <div className="dp-translate-pane">
                  <div className="dp-translate-pane-head">Target (Japanese)</div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p># DocPlaybook の概要</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-add">
                    <div className="dp-translate-label">regenerated</div>
                    <p>変更された block のみを対象に、基線ベースで翻訳します。</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p>変更されていないセクションは既存の訳文をそのまま維持します。</p>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">translate</span> one article request, changed blocks only</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 1 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>learn</span>
              <span>README.ja.md -&gt; memories/ja.md</span>
            </div>
            <div className="dp-demo-body dp-demo-body-learn">
              <div className="dp-learn-flow">
                <div className="dp-learn-card dp-demo-line">
                  <div className="dp-learn-label">review change</div>
                  <div className="dp-learn-before">ワークスペースを設定します</div>
                  <div className="dp-learn-arrow">-&gt;</div>
                  <div className="dp-learn-after">workspace を設定します</div>
                </div>
                <div className="dp-learn-memory dp-demo-line">
                  <div className="dp-learn-label">memory patch</div>
                  <div className="dp-learn-patch">
                    <div className="dp-learn-path">.docplaybook/memories/ja.md</div>
                    <div className="dp-learn-patch-line">+++ workspace -&gt; keep as workspace</div>
                    <div className="dp-learn-patch-line">+++ keep concise technical Japanese</div>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line dp-demo-accent">append reusable language rules from this review</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 2 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>lint</span>
              <span>editor diagnostics</span>
            </div>
            <div className="dp-demo-body dp-demo-body-lint">
              <div className="dp-lint-editor">
                <div className="dp-lint-line dp-demo-line">
                  <span className="dp-lint-number">12</span>
                  <span className="dp-lint-text">DocPlaybook supports the <span className="dp-lint-underline">AI gateway</span> mode.</span>
                </div>
                <div className="dp-lint-line dp-demo-line">
                  <span className="dp-lint-number">13</span>
                  <span className="dp-lint-text">Use the same term across the whole translation.</span>
                </div>
                <div className="dp-lint-tooltip dp-demo-line">
                  <span className="dp-lint-severity">warn</span>
                  Terminology mismatch: memory prefers &quot;gateway&quot;, not &quot;AI gateway&quot;.
                </div>
                <div className="dp-lint-line dp-demo-line">
                  <span className="dp-lint-number">18</span>
                  <span className="dp-lint-text">This option is <span className="dp-lint-underline">super easy</span> to use.</span>
                </div>
                <div className="dp-lint-tooltip dp-demo-line">
                  <span className="dp-lint-severity">info</span>
                  Tone drift: prefer neutral technical wording over promotional phrasing.
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">summary</span> 2 issues found in this file</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeInstall() {
  return (
    <section className="dp-home-section">
      <div className="dp-home-section-head">
        <span className="dp-home-eyebrow">Install</span>
        <h2 className="dp-home-section-title">Add DocPlaybook to the docs project you already have.</h2>
        <p className="dp-home-section-copy">
          Start inside your existing documentation repo, run initialization once, then translate and learn as the docs change.
        </p>
      </div>

      <div className="dp-install-switcher">
        <input type="radio" name="dp-pm" id="dp-pnpm" defaultChecked />
        <input type="radio" name="dp-pm" id="dp-npm" />
        <input type="radio" name="dp-pm" id="dp-yarn" />

        <div className="dp-install-tabs">
          <label htmlFor="dp-pnpm">pnpm</label>
          <label htmlFor="dp-npm">npm</label>
          <label htmlFor="dp-yarn">yarn</label>
        </div>

        <div className="dp-install-panel dp-install-panel-pnpm">
          <pre><code>{`pnpm add -D docplaybook
pnpm exec docplaybook init .`}</code></pre>
        </div>

        <div className="dp-install-panel dp-install-panel-npm">
          <pre><code>{`npm install --save-dev docplaybook
npx docplaybook init .`}</code></pre>
        </div>

        <div className="dp-install-panel dp-install-panel-yarn">
          <pre><code>{`yarn add -D docplaybook
yarn exec docplaybook init .`}</code></pre>
        </div>
      </div>
    </section>
  );
}

function HomeLayout() {
  return (
    <>
      <div className="dp-home-main">
        <div className="dp-home-hero">
          <HomeHero />
          <div className="dp-home-frameworks">
            <span className="dp-home-frameworks-label">Works with</span>
            <FrameworkBadges />
          </div>
        </div>
        <div className="dp-home-content">
          <HomeShowcase />
          <HomeInstall />
        </div>
      </div>
      <HomeFooter />
    </>
  );
}

export { HomeLayout };
