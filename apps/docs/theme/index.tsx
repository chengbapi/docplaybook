import { useEffect, useState } from 'react';
import { HomeFooter, HomeHero } from '@rspress/core/theme-original';
import { useI18n } from '@rspress/core/runtime';

export * from '@rspress/core/theme-original';

function FrameworkBadges() {
  const t = useI18n();
  const base = '/docplaybook';
  const frameworks = [
    {
      name: 'Rspress',
      logo: `${base}/framework-rspress.svg`
    },
    {
      name: 'Docusaurus',
      logo: `${base}/framework-docusaurus.svg`
    },
    {
      name: 'VitePress',
      logo: `${base}/framework-vitepress.svg`
    }
  ] as const;

  return (
    <div className="dp-nav-frameworks" aria-label={t('supportedFrameworks')}>
      {frameworks.map((framework) => (
        <a
          key={framework.name}
          className="dp-nav-framework"
          href={`${base}/guide/quick-start`}
          title={t('worksWithFramework').replace('{framework}', framework.name)}
        >
          <img src={framework.logo} alt={framework.name} />
          <span>{framework.name}</span>
        </a>
      ))}
    </div>
  );
}

function HomeShowcase() {
  const t = useI18n();
  const showcaseItems = [
    {
      title: t('translateTitle'),
      description: t('translateDescription')
    },
    {
      title: t('learnTitle'),
      description: t('learnDescription')
    },
    {
      title: t('lintTitle'),
      description: t('lintDescription')
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
        <span className="dp-home-eyebrow">{t('coreWorkflow')}</span>
        <h2 className="dp-home-section-title">{t('coreWorkflowTitle')}</h2>
        <p className="dp-home-section-copy">{t('coreWorkflowCopy')}</p>
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
              <span>README.md {'->'} README.ja.md</span>
            </div>
            <div className="dp-demo-body dp-demo-body-translate">
              <div className="dp-translate-compare">
                <div className="dp-translate-pane">
                  <div className="dp-translate-pane-head">{t('sourceEnglish')}</div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p># DocPlaybook overview</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-changed">
                    <div className="dp-translate-label">{t('changedLabel')}</div>
                    <p>DocPlaybook rechecks this article because the source file changed.</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p>Markdown structure, code fences, and protected fields stay intact during writeback.</p>
                  </div>
                </div>
                <div className="dp-translate-pane">
                  <div className="dp-translate-pane-head">{t('targetJapanese')}</div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p># DocPlaybook の概要</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-add">
                    <div className="dp-translate-label">{t('regeneratedLabel')}</div>
                    <p>このターゲット記事全体を安全に再生成し、構造を保ったまま書き戻します。</p>
                  </div>
                  <div className="dp-translate-block dp-translate-block-stable">
                    <p>フロントマター、コードブロック、保護された値はそのまま扱われます。</p>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">translate</span> {t('oneArticleRequest')}</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 1 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>learn</span>
              <span>README.ja.md {'->'} memories/ja.md</span>
            </div>
            <div className="dp-demo-body dp-demo-body-learn">
              <div className="dp-learn-flow">
                <div className="dp-learn-card dp-demo-line">
                  <div className="dp-learn-label">{t('reviewChange')}</div>
                  <div className="dp-learn-before">ワークスペースを設定します</div>
                  <div className="dp-learn-arrow">-&gt;</div>
                  <div className="dp-learn-after">workspace を設定します</div>
                </div>
                <div className="dp-learn-memory dp-demo-line">
                  <div className="dp-learn-label">{t('memoryPatch')}</div>
                  <div className="dp-learn-patch">
                    <div className="dp-learn-path">.docplaybook/memories/ja.md</div>
                    <div className="dp-learn-patch-line">+++ workspace -&gt; keep as workspace</div>
                    <div className="dp-learn-patch-line">+++ keep concise technical Japanese</div>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line dp-demo-accent">{t('appendReusableRules')}</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 2 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>lint</span>
              <span>{t('editorDiagnostics')}</span>
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
                  {t('terminologyMismatch')}
                </div>
                <div className="dp-lint-line dp-demo-line">
                  <span className="dp-lint-number">18</span>
                  <span className="dp-lint-text">This option is <span className="dp-lint-underline">super easy</span> to use.</span>
                </div>
                <div className="dp-lint-tooltip dp-demo-line">
                  <span className="dp-lint-severity">info</span>
                  {t('toneDrift')}
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">summary</span> {t('issuesSummary')}</div>
            </div>
          </div>
        </div>
      </div>

      <a className="dp-showcase-link" href="/docplaybook/guide/demo">
        {t('openFullDemo')}
      </a>
    </section>
  );
}

function HomeInstall() {
  const t = useI18n();
  return (
    <section className="dp-home-section">
      <div className="dp-home-section-head">
        <span className="dp-home-eyebrow">{t('install')}</span>
        <h2 className="dp-home-section-title">{t('installTitle')}</h2>
        <p className="dp-home-section-copy">{t('installCopy')}</p>
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
  const t = useI18n();
  return (
    <>
      <div className="dp-home-main">
        <div className="dp-home-hero">
          <HomeHero />
          <div className="dp-home-frameworks">
            <span className="dp-home-frameworks-label">{t('worksWith')}</span>
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
