// Le mode d'emploi du connecteur Claude (19/10/2026) — la page demandée par
// l'annuaire des connecteurs. Bilingue : les utilisateurs sont francophones,
// les examinateurs d'Anthropic lisent l'anglais.

const URL_MCP = "https://ngsportcoaching.com/mcp";

const Bloc = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3">{titre}</h2>
    <div className="text-gray-600 text-sm space-y-2">{children}</div>
  </section>
);

const EXEMPLES: [string, string][] = [
  ["Quelle est ma séance de demain ? Envoie-la sur ma montre.", "What's my session tomorrow? Send it to my watch."],
  ["Comment je récupère cette semaine ?", "How is my recovery this week?"],
  ["Analyse ma sortie d'hier : allure, cardio, chaleur.", "Analyse yesterday's run: pace, heart rate, heat."],
  ["Il fera 30 °C dimanche : comment adapter mon semi ?", "It will be 30 °C on Sunday: how should I adapt my half-marathon?"],
  ["Déplace ma séance de jeudi à vendredi.", "Move my Thursday session to Friday."],
];

export default function ConnecteurClaude() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 px-4 py-12">
      <div className="max-w-2xl mx-auto bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Connecter Claude à App-Coach</h1>
        <p className="text-gray-500 text-sm mb-8">Connect Claude to App-Coach — your training plan, sessions, form and recovery, in your own Claude.</p>

        <Bloc titre="Ce que fait le connecteur · What it does">
          <p>Claude lit votre planning, vos séances, votre forme, votre récupération et la météo prévue, et peut préparer, modifier ou envoyer vos séances vers votre montre (via intervals.icu). Il agit avec <strong>vos droits</strong> : il ne voit que ce que vous voyez dans l&apos;app, et <strong>chaque modification vous est montrée avant</strong> d&apos;être faite.</p>
          <p className="text-gray-500">Claude reads your plan, sessions, fitness, recovery and forecast, and can prepare, edit or send sessions to your watch (through intervals.icu). It acts with your own permissions, and every change is previewed and needs your explicit &ldquo;yes&rdquo;.</p>
        </Bloc>

        <Bloc titre="Installer · Setup">
          <ol className="list-decimal ml-5 space-y-1">
            <li>Il vous faut un compte App-Coach (l&apos;app ou ngsportcoaching.com). <span className="text-gray-500">You need an App-Coach account.</span></li>
            <li>Dans Claude : <strong>Réglages → Connecteurs → Ajouter un connecteur personnalisé</strong>, adresse : <code className="bg-slate-100 rounded px-1.5 py-0.5 text-slate-800">{URL_MCP}</code></li>
            <li>Claude ouvre une page App-Coach : connectez-vous avec le compte de l&apos;app, lisez ce qui est partagé, puis <strong>Autoriser</strong>. <span className="text-gray-500">Sign in with your App-Coach account and click Authorize (OAuth 2.1).</span></li>
          </ol>
          <p>C&apos;est fait une fois : l&apos;accès se renouvelle tout seul. <span className="text-gray-500">One-time: access renews automatically.</span></p>
        </Bloc>

        <Bloc titre="Exemples · Examples">
          <ul className="space-y-2">
            {EXEMPLES.map(([fr, en]) => (
              <li key={fr} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="text-gray-800">« {fr} »</span><br /><span className="text-gray-400 text-xs">{en}</span>
              </li>
            ))}
          </ul>
        </Bloc>

        <Bloc titre="Données et confidentialité · Data & privacy">
          <p>L&apos;accès comprend vos données de sommeil et de récupération si votre montre les envoie. Il demande votre accord explicite, et se coupe à tout moment : <strong>Réglages → Connecter une IA → Révoquer</strong>. Détails : <a href="/privacy" className="text-emerald-600 font-bold hover:underline">politique de confidentialité</a>.</p>
          <p className="text-gray-500">Access includes sleep and recovery data if your watch provides them. It requires your explicit consent and can be revoked any time in Settings. App-Coach analyses compare you to yourself and are never medical advice.</p>
        </Bloc>

        <Bloc titre="Aide · Support">
          <a href="mailto:martinvitte@gmail.com" className="text-emerald-600 font-bold hover:underline">martinvitte@gmail.com</a>
        </Bloc>
      </div>
    </main>
  );
}
