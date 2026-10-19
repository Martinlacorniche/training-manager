// Politique de confidentialité — réécrite le 19/10/2026 pour coller à ce que
// l'app fait vraiment (données de santé, Strava, intervals.icu, IA) : c'est
// aussi la page exigée par l'annuaire des connecteurs Claude.

const S = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3">{titre}</h2>
    <div className="text-gray-600 text-sm space-y-2">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 px-4 py-12">
      <div className="max-w-2xl mx-auto bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12">
        <div className="mb-8">
          <a href="/" className="text-emerald-600 text-sm font-semibold hover:underline transition">← Retour à l&apos;accueil</a>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Politique de confidentialité</h1>
        <p className="text-emerald-600 font-bold text-base mb-1">C&apos;est Ludique · NG Sport Coaching</p>
        <p className="text-gray-400 text-sm mb-8">Développé par Martin Vitté — Dernière mise à jour : 19 octobre 2026</p>
        <hr className="border-gray-200 mb-8" />

        <S titre="1. Quelles données sont collectées ?">
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Compte</strong> : adresse e-mail, nom, rôle (athlète ou coach).</li>
            <li><strong>Entraînement</strong> : planning, séances, ressenti (RPE), commentaires, compétitions.</li>
            <li><strong>Activités</strong> reçues de Strava ou d&apos;intervals.icu, si vous les connectez : durée, distance, fréquence cardiaque, allure, puissance, tracé GPS.</li>
            <li><strong>Santé et bien-être</strong>, si votre montre les envoie à intervals.icu : variabilité cardiaque nocturne, fréquence cardiaque de repos, sommeil.</li>
            <li><strong>Profil physique</strong> facultatif : année de naissance, sexe, poids.</li>
          </ul>
        </S>

        <S titre="2. Utilisation des données">
          <p>Uniquement pour faire fonctionner le service : afficher votre planning, analyser vos séances, estimer votre forme et votre récupération, envoyer vos séances vers votre montre, et vous notifier.</p>
          <p>Ces analyses comparent chacun à lui-même. Ce ne sont jamais des diagnostics médicaux.</p>
        </S>

        <S titre="3. Qui voit quoi">
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Votre coach</strong> voit votre planning, vos séances et votre ressenti. Il ne voit <strong>jamais vos chiffres de santé</strong> (sommeil, variabilité cardiaque, fréquence de repos) ; l&apos;état de forme ne lui est montré que si vous l&apos;acceptez, et vous pouvez le retirer.</li>
            <li><strong>Votre partenaire « duo »</strong>, si vous en liez un, voit votre planning.</li>
            <li>Aucune donnée n&apos;est vendue, ni utilisée à des fins publicitaires.</li>
          </ul>
        </S>

        <S titre="4. Assistants IA (Claude)">
          <p><strong>Votre propre assistant.</strong> Vous pouvez connecter votre assistant Claude (Anthropic) à votre compte, par un lien ou par une autorisation depuis Claude. Il accède alors à ce que vous voyez vous-même dans l&apos;app — y compris vos données de sommeil et de récupération — et vous demande toujours avant de modifier quoi que ce soit. Cette connexion demande votre accord explicite, enregistré, et vous pouvez la couper à tout moment dans vos Réglages (« Connecter une IA » → Révoquer). Ce que vous échangez avec Claude relève ensuite de la politique de confidentialité d&apos;Anthropic.</p>
          <p><strong>Les fonctions IA de l&apos;app.</strong> Certaines fonctions (traduire une séance pour la montre, composer un renforcement, adapter une séance) envoient à l&apos;API d&apos;Anthropic les consignes de la séance, vos repères d&apos;entraînement (zones, allures) et les règles d&apos;adaptation qui vous concernent, sans votre nom ni votre e-mail.</p>
        </S>

        <S titre="5. Services tiers">
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Supabase</strong> : hébergement de la base de données et des comptes.</li>
            <li><strong>Netlify</strong> : hébergement du site.</li>
            <li><strong>Strava</strong> et <strong>intervals.icu</strong> : seulement si vous les connectez, pour recevoir vos activités et envoyer vos séances à votre montre.</li>
            <li><strong>Open-Meteo</strong> : la météo de vos sorties (un point GPS du parcours et la date sont envoyés, sans aucune information sur vous).</li>
            <li><strong>Anthropic</strong> : voir la section 4.</li>
            <li><strong>Expo</strong> (notifications sur téléphone) et <strong>Resend</strong> (e-mails).</li>
          </ul>
        </S>

        <S titre="6. Sécurité">
          <p>Accès chiffrés, données protégées par des règles d&apos;accès en base (chacun ne lit que ce à quoi il a droit), clés d&apos;accès des assistants IA stockées hachées et révocables.</p>
        </S>

        <S titre="7. Vos droits">
          <p>Vous pouvez à tout moment accéder à vos données, les corriger, couper chaque connexion (Strava, intervals.icu, assistant IA) ou demander la suppression de votre compte et de toutes vos données, en écrivant à :</p>
          <a href="mailto:martinvitte@gmail.com" className="text-emerald-600 font-bold hover:underline">martinvitte@gmail.com</a>
        </S>
      </div>
    </main>
  );
}
