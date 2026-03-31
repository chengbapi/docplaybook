import { useEffect, useState } from 'react';
import { HomeFooter, HomeHero } from '@rspress/core/theme-original';

export * from '@rspress/core/theme-original';

function FrameworkBadges() {
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
    <div className="dp-nav-frameworks" aria-label="Supported frameworks">
      {frameworks.map((framework) => (
        <a
          key={framework.name}
          className="dp-nav-framework"
          href={`${base}/guide/quick-start`}
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
      description: 'Git source diff + playbook + memory -> LLM -> updated target blocks.'
    },
    {
      title: 'Learn',
      description: 'Reviewed translation diff -> LLM -> structured playbook and memory updates.'
    },
    {
      title: 'Lint',
      description: 'Target doc + playbook + memory + lint rules -> LLM -> issue list.'
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
        <h2 className="dp-home-section-title">See what each command sends into the model and what comes back.</h2>
        <p className="dp-home-section-copy">
          DocPlaybook is Git-first. `translate`, `learn`, and `lint` are three different contracts with the
          model, and each one should be easy to reason about.
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
              <span>source diff + rules {'->'} translated target</span>
            </div>
            <div className="dp-demo-body dp-demo-body-translate">
              <div className="dp-flow-grid">
                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Inputs</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-chip">Source A at Git HEAD</div>
                      <div className="dp-flow-chip">Source A in working tree</div>
                      <div className="dp-flow-chip">playbook.md</div>
                      <div className="dp-flow-chip">memories/en.md</div>
                      <div className="dp-flow-chip">Current target B</div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Example input</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-diff-line">- 使用知识库管理文档。</div>
                      <div className="dp-diff-line dp-diff-add">+ 使用知识库统一管理团队文档。</div>
                      <div className="dp-flow-note">Memory rule: Translate “知识库” as “Wiki”.</div>
                    </div>
                  </div>
                </div>

                <div className="dp-flow-llm-wrap">
                  <div className="dp-flow-arrow">-&gt;</div>
                  <div className="dp-flow-llm">
                    <div className="dp-flow-llm-title">LLM</div>
                    <p>Regenerate only the changed target blocks.</p>
                  </div>
                  <div className="dp-flow-arrow">-&gt;</div>
                </div>

                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Output</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-chip dp-flow-chip-strong">Updated target language B</div>
                      <div className="dp-flow-note">Only changed blocks are replaced.</div>
                      <div className="dp-flow-note">Unchanged blocks remain stable.</div>
                      <div className="dp-flow-note">Rules from playbook and memory should still be visible.</div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Expected output</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-out">Use the Wiki to manage team docs in one place.</div>
                      <div className="dp-flow-note">The term stays Wiki, not Knowledge Base.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">translate</span> source diff + playbook + memory {'->'} updated translated blocks</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 1 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>learn</span>
              <span>review diff {'->'} structured updates</span>
            </div>
            <div className="dp-demo-body dp-demo-body-learn">
              <div className="dp-flow-grid">
                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Inputs</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-chip">Target B at Git HEAD</div>
                      <div className="dp-flow-chip">Target B in working tree</div>
                      <div className="dp-flow-chip">Current source A</div>
                      <div className="dp-flow-chip">playbook.md</div>
                      <div className="dp-flow-chip">memories/en.md</div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Example input</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-diff-line">- Use the knowledge base to manage docs.</div>
                      <div className="dp-diff-line dp-diff-add">+ Use the Wiki to manage docs.</div>
                      <div className="dp-flow-note">A reviewer corrected a recurring term in the translation.</div>
                    </div>
                  </div>
                </div>

                <div className="dp-flow-llm-wrap">
                  <div className="dp-flow-arrow">-&gt;</div>
                  <div className="dp-flow-llm">
                    <div className="dp-flow-llm-title">LLM</div>
                    <p>Judge whether the edit is reusable and return structured updates.</p>
                  </div>
                  <div className="dp-flow-arrow">-&gt;</div>
                </div>

                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Output</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-chip dp-flow-chip-strong">Updated playbook.md</div>
                      <div className="dp-flow-chip dp-flow-chip-strong">Updated memories/en.md</div>
                      <div className="dp-flow-note">If the edit is one-off, the update can be empty.</div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Expected output</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-out">accepted_rules: Translate “知识库” as “Wiki”.</div>
                      <div className="dp-flow-out">memory_text: ... Terminology ... Wiki ...</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line dp-demo-accent">target diff {'->'} LLM {'->'} structured playbook and memory updates</div>
            </div>
          </div>

          <div className={`dp-demo${activeIndex === 2 ? ' is-active' : ''}`}>
            <div className="dp-demo-bar">
              <span>lint</span>
              <span>rule-aware review</span>
            </div>
            <div className="dp-demo-body dp-demo-body-lint">
              <div className="dp-flow-grid">
                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Inputs</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-chip">Source A</div>
                      <div className="dp-flow-chip">Target B</div>
                      <div className="dp-flow-chip">playbook.md</div>
                      <div className="dp-flow-chip">memories/en.md</div>
                      <div className="dp-flow-chip">Lint rules</div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Example input</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-note">Memory prefers “gateway”, but the translation says “AI gateway”.</div>
                      <div className="dp-flow-note">Tone should stay neutral and technical.</div>
                    </div>
                  </div>
                </div>

                <div className="dp-flow-llm-wrap">
                  <div className="dp-flow-arrow">-&gt;</div>
                  <div className="dp-flow-llm">
                    <div className="dp-flow-llm-title">LLM</div>
                    <p>Review the translation against memory, playbook, and lint rules.</p>
                  </div>
                  <div className="dp-flow-arrow">-&gt;</div>
                </div>

                <div className="dp-flow-column">
                  <div className="dp-flow-card">
                    <div className="dp-flow-card-head">Output</div>
                    <div className="dp-flow-card-body dp-flow-issues">
                      <div className="dp-flow-issue">
                        <span className="dp-lint-severity">warn</span>
                        Terminology mismatch: use “gateway”.
                      </div>
                      <div className="dp-flow-issue">
                        <span className="dp-lint-severity">info</span>
                        Tone drift: prefer neutral technical wording.
                      </div>
                    </div>
                  </div>
                  <div className="dp-flow-card dp-flow-card-code">
                    <div className="dp-flow-card-head">Expected output</div>
                    <div className="dp-flow-card-body">
                      <div className="dp-flow-out">score + issue list + optional safe fixes</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="dp-demo-line"><span className="dp-demo-pill">lint</span> target doc + playbook + memory + rules {'->'} issue list</div>
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
