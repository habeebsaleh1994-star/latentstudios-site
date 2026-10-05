import { sampleIds, sampleInfo } from "./samples";
export function Examples() {
  return (
    <main className="examples-page">
      <header>
        <a href="/" className="examples-brand">
          l. <span>Latent Studio</span>
        </a>
        <a href="/">Return to your draft ↗</a>
      </header>
      <section className="examples-intro">
        <span className="eyebrow">Ten directions. A practice of your own.</span>
        <h1>
          A starting point.
          <br />
          An identity of your own.
        </h1>
        <p>
          Explore fictional photographers, visual artists, writers and
          filmmakers. Each opens its own separate demo studio. Your draft stays
          where you left it.
        </p>
      </section>
      <div className="examples-grid">
        {sampleIds.map((id, i) => {
          const s = sampleInfo[id];
          return (
            <a
              href={`?demo=${id}`}
              key={id}
              className={`example-card example-${id}`}
            >
              <div className="example-art" style={{ background: s.color }}>
                {s.image ? (
                  <img src={s.image} alt="" />
                ) : (
                  <p>
                    The door remembers
                    <br />
                    the shape of
                    <br />
                    every leaving.
                  </p>
                )}
                <span>
                  {String(i + 1).padStart(2, "0")} / {s.style}
                </span>
              </div>
              <div className="example-caption">
                <h2>{s.name}</h2>
                <span>Open studio ↗</span>
              </div>
              <span className="eyebrow">{s.practice}</span>
              <p>{s.description}</p>
            </a>
          );
        })}
      </div>
      <footer>
        Fictional identities · original sample writing and vector works ·
        licensed photographs.
        <br />
        Simulated design coverage, not real artist research. Demo edits save
        independently in this browser.
      </footer>
    </main>
  );
}
