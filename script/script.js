/* script.js - COMPLETE FIXED VERSION (language on index.html + Sign Out on all logged-in pages) */

const translations = {
    // Navbar buttons
    "Sign Out": { en: "Sign Out", no: "Logg ut" },
    "Sign In": { en: "Sign In", no: "Logg inn" },
    "Sign Up": { en: "Sign Up", no: "Registrer deg" },
    "Sign in/up": { en: "Sign In/Up", no: "Logg inn/registrer" },
    "Go Back": { en: "Go Back", no: "Gå tilbake" },

    // Sidebar + headers
    "MyDashboard": { en: "MyDashboard", no: "Mitt Dashbord" },
    "MyHomes": { en: "MyHomes", no: "Mine Hjem" },
    "MyNeighborhood": { en: "MyNeighborhood", no: "Mitt Nabolag" },
    "MyVehicles": { en: "MyVehicles", no: "Mine Kjøretøy" },
    "MyDocuments": { en: "MyDocuments", no: "Mine Dokumenter" },
    "MyPlanning": { en: "MyPlanning", no: "Min Planlegging" },
    "MyTools": { en: "MyTools", no: "Mine Verktøy" },
    "MyProfile": { en: "MyProfile", no: "Min Profil" },
    "Dummy Text 1": { en: "Dummy Text 1", no: "Dummy tekst 1" },
    "Dummy Text 2": { en: "Dummy Text 2", no: "Dummy tekst 2" },
    "Dummy Text 3": { en: "Dummy Text 3", no: "Dummy tekst 3" },
    "Dummy Text 4": { en: "Dummy Text 4", no: "Dummy tekst 4" },
    "About Us": { en: "About Us", no: "Om oss" },
    "Social Media": { en: "Social Media", no: "Sosiale medier" },
    "Contact Info": { en: "Contact Info", no: "Kontaktinfo" },
    "Partners": { en: "Partners", no: "Partnere" },
    "Security": { en: "Security", no: "Sikkerhet" },
    "Subscription": { en: "Subscription", no: "Abonnement" },
    "Planning": { en: "Planning", no: "Planlegging" },
    "Documents": { en: "Documents", no: "Dokumenter" },

    // Date columns
    "Date Performed": { en: "Date Performed", no: "Utført dato" },
    "Date Uploaded": { en: "Date Uploaded", no: "Opplastingsdato" },
    "Doc Date": { en: "Date Performed", no: "Utført dato" },
    "Added Date": { en: "Date Uploaded", no: "Opplastingsdato" },

    // Footer
    "Phone:": { en: "Phone", no: "Telefon" },

    // Everything else (your full list)
    "Name:": { en: "Name", no: "Navn" },
    "Email:": { en: "Email", no: "E-post" },
    "Address:": { en: "Address", no: "Adresse" },
    "Change Personal Information": { en: "Change Personal Information", no: "Endre personlig informasjon" },
    "Family Settings": { en: "Family Settings", no: "Familieinnstillinger" },
    "Connected Homes": { en: "Connected Homes", no: "Tilkoblede hjem" },
    "Connected Vehicles": { en: "Connected Vehicles", no: "Tilkoblede kjøretøy" },
    "Access Control": { en: "Access Control", no: "Tilgangskontroll" },
    "View Terms and Conditions": { en: "View Terms and Conditions", no: "Vis vilkår og betingelser" },
    "Change Password": { en: "Change Password", no: "Endre passord" },
    "Notification Settings": { en: "Notification Settings", no: "Varslingsinnstillinger" },
    "Delete Account": { en: "Delete Account", no: "Slett konto" },
    "Manage Subscription": { en: "Manage Subscription", no: "Administrer abonnement" },
    "Payment Methods": { en: "Payment Methods", no: "Betalingsmetoder" },
    "Add documents": { en: "Add documents", no: "Legg til dokumenter" },
    "Search documents...": { en: "Search documents...", no: "Søk i dokumenter..." },
    "Last modified": { en: "Last modified", no: "Sist endret" },
    "MyHome": { en: "MyHome", no: "Mitt hjem" },
    "Name": { en: "Name", no: "Navn" },
    "Size": { en: "Size", no: "Størrelse" },
    "Connected item": { en: "Connected item", no: "Tilkoblet element" },
    "Alphabetic": { en: "Alphabetic", no: "Alfabetisk" },
    "Doctype": { en: "Doctype", no: "Dokumenttype" },
    "Author": { en: "Author", no: "Forfatter" },
    "My Homes": { en: "My Homes", no: "Mine hjem" },
    "No home registered": { en: "No home registered", no: "Ingen hjem registrert" },
    "Start registering your home": { en: "Start registering your home", no: "Start å registrere ditt hjem" },
    "No Vehicles registered": { en: "No Vehicles registered", no: "Ingen kjøretøy registrert" },
    "Start registering your vehicles": { en: "Start registering your vehicles", no: "Start å registrere dine kjøretøy" },
    "Latest Documents": { en: "Latest Documents", no: "Siste dokumenter" },
    "Add Documents": { en: "Add Documents", no: "Legg til dokumenter" },
    "View all documents": { en: "View all documents", no: "Vis alle dokumenter" },
    "No plans yet": { en: "No plans yet", no: "Ingen planer ennå" },
    "Add new plan": { en: "Add new plan", no: "Legg til ny plan" },
    "View full calendar": { en: "View full calendar", no: "Vis full kalender" },
    "Try MyTools": { en: "Try MyTools", no: "Prøv mine verktøy" },
    "Edit MyProfile": { en: "Edit MyProfile", no: "Rediger min profil" },
    "MyTools is different tools for creating floorplans, item hierarchy, and other advanced tools.": { en: "MyTools is different tools for creating floorplans, item hierarchy, and other advanced tools.", no: "Mine verktøy er forskjellige verktøy for å lage plantegninger, varehierarki og andre avanserte verktøy." },
    "Edit personal information, add family members, share access etc.": { en: "Edit personal information, add family members, share access etc.", no: "Rediger personlig informasjon, legg til familiemedlemmer, del tilgang osv." },
    "Sign in": { en: "Sign in", no: "Logg inn" },
    "Sign up": { en: "Sign up", no: "Registrer deg" },
    "Already have an account?": { en: "Already have an account?", no: "Har du allerede en konto?" },
    "Are you new here?": { en: "Are you new here?", no: "Er du ny her?" },
    "Terms of use": { en: "Terms of use", no: "Bruksvilkår" },
    "Revolutionise the way you take care of your home": { en: "Revolutionise the way you take care of your home", no: "Revolusjoner måten du tar vare på hjemmet ditt på" },
    "For Businesses": { en: "For Businesses", no: "For Bedrifter" },
    "Welcome to MyDashboard": {en: "Welcome to MyDashboard", no: "Velkommen til Mitt Dashbord"},
    "Start managing smarter today.": {en: "Start managing smarter today.", no: "Begynn å administrere smartere i dag."},
    "Join homeowners, landlords, and contractors who keep their properties organized and their clients happy.": {en: "Join homeowners, landlords, and contractors who keep their properties organized and their clients happy.", no: "Bli med homeowners, landlords, og entrepreneurs som holder sine eiendommer organisert og kundene sine fornøyde."},
    "Get Started Free": {en: "Get Started Free", no: "Kom i gang gratis"},
    "Learn More": {en: "Learn More", no: "Lær mer"},
    "Ready to simplify your property care?": {en: "Ready to simplify your property care?", no: "Klar til å forenkle eiendomsvedlikeholdet ditt?"},
    "No credit card required. Start organizing in minutes.": {en: "No credit card required. Start organizing in minutes.", no: "Intet kredittkort påkrevd. Begynn å organisere på få minutter."},
    "Start Your Free Account": {en: "Start Your Free Account", no: "Start din gratis konto"},
    "For Homeowners": {en: "For Homeowners", no: "For huseiere"},
    "Keep your home running smoothly with organized maintenance records, seasonal reminders, and contractor history all in one place.": {en: "Keep your home running smoothly with organized maintenance records, seasonal reminders, and contractor history all in one place.", no: "Hold hjemmet ditt i gang med organiserte vedlikeholdsposter, sesongmessige påminnelser og entreprenørhistorikk på ett sted."},
    "Track Everything": {en: "Track Everything", no: "Spor alt"},
    "Document repairs, warranties, service dates, and costs in one easy-to-search home file.": {en: "Document repairs, warranties, service dates, and costs in one easy-to-search home file.", no: "Dokumenter reparasjoner, garantier, servicedatoer og kostnader i en lett søkbar hjemmefil."},
    "Never Miss a Task": {en: "Never Miss a Task", no: "Gå aldri glipp av en oppgave"},
    "Get reminders for HVAC maintenance, gutter cleaning, inspections, and seasonal care.": {en: "Get reminders for HVAC maintenance, gutter cleaning, inspections, and seasonal care.", no: "Få påminnelser om HVAC-vedlikehold, rengjøring av takrennestylter, inspeksjoner og sesongmessig pleie."},
    "Build Your Home Profile": {en: "Build Your Home Profile", no: "Bygg din hjemmeprofil"},
    "Plan upgrades, track improvements, and keep receipts that help when selling.": {en: "Plan upgrades, track improvements, and keep receipts that help when selling.", no: "Planlegg oppgraderinger, spor forbedringer, og hold kvitteringer som hjelper ved salg."},
    "Explore for Homeowners →": {en: "Explore for Homeowners →", no: "Utforsk for huseiere →"},
    "For Landlords": {en: "For Landlords", no: "For utleiere"},
    "Manage multiple properties with maintenance schedules, tenant communications, and property compliance records.": {en: "Manage multiple properties with maintenance schedules, tenant communications, and property compliance records.", no: "Administrer flere eiendommer med vedlikeholdsplaner, tenantkommunikasjon og eiendomsoverholdelsesregistre."},
    "Schedule & Track": {en: "Schedule & Track", no: "Planlegg og spor"},
    "Plan annual inspections, coordinate contractor visits, and monitor maintenance deadlines across all units.": {en: "Plan annual inspections, coordinate contractor visits, and monitor maintenance deadlines across all units.", no: "Planlegg årlige inspeksjoner, koordiner entreprenørbesøk, og overvåk vedlikeholdsfrister på alle enheter."},
    "Property Portfolios": {en: "Property Portfolios", no: "Eiendomsporteføljer"},
    "Keep each property organized with dedicated maintenance logs, tenant histories, and cost tracking.": {en: "Keep each property organized with dedicated maintenance logs, tenant histories, and cost tracking.", no: "Hold hver eiendom organisert med dediserte vedlikeholdsmeldinger, tenanthistorier og kostnadssporing."},
    "Stay Compliant": {en: "Stay Compliant", no: "Forbli kompatibel"},
    "Maintain records for inspections, safety checks, and regulatory requirements by property.": {en: "Maintain records for inspections, safety checks, and regulatory requirements by property.", no: "Oppretthold poster for inspeksjoner, sikkerhetskontroller og regulatoriske krav per eiendom."},
    "Explore for Landlords →": {en: "Explore for Landlords →", no: "Utforsk for utleiere →"},
    "For Contractors": {en: "For Contractors", no: "For entreprenører"},
    "Manage client projects with estimates, progress photos, invoices, and professional documentation your clients trust.": {en: "Manage client projects with estimates, progress photos, invoices, and professional documentation your clients trust.", no: "Administrer klientprosjekter med estimater, progresfoto, fakturaer og profesjonell dokumentasjon som kundene dine stoler på."},
    "Capture & Document": {en: "Capture & Document", no: "Fanger og dokumenterer"},
    "Store before/after photos, estimates, invoices, and work notes for every job in one searchable location.": {en: "Store before/after photos, estimates, invoices, and work notes for every job in one searchable location.", no: "Lagre før/etter-bilder, estimater, fakturaer og arbeidsmerknaderk for hver jobb på ett søkbart sted."},
    "Client Communication": {en: "Client Communication", no: "Klientkommunikasjon"},
    "Share project progress, timeline updates, and completion reports that build confidence and trust.": {en: "Share project progress, timeline updates, and completion reports that build confidence and trust.", no: "Del prosjektfremgang, tidslinjeoppateringar og sluttrapporter som bygger tillit og tillit."},
    "Professional Records": {en: "Professional Records", no: "Profesjonelle poster"},
    "Maintain organized project files that demonstrate quality work and help with repeat business.": {en: "Maintain organized project files that demonstrate quality work and help with repeat business.", no: "Oppretthold organiserte prosjektfiler som demonstrerer kvalitetsarbeid og hjelp med gjentatt virksomhet."},
    "Explore for Contractors →": {en: "Explore for Contractors →", no: "Utforsk for entreprenører →"}
};

let currentLang = 'en';

function initPrivacyConsent() {
    const key = 'vedlikeholdt.privacyConsent';
    const version = 1;
    const read = () => {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value && value.version === version ? value : null;
        } catch (_) {
            return null;
        }
    };
    const allowed = (category) => category === 'necessary' || Boolean(read()?.[category]);
    const apply = (value) => {
        ['preferences', 'analytics', 'marketing'].forEach((category) => {
            document.documentElement.dataset[`consent${category[0].toUpperCase()}${category.slice(1)}`] = String(Boolean(value?.[category]));
        });
        window.dispatchEvent(new CustomEvent('vedlikeholdt:consentchange', { detail: value }));
    };
    const save = (choices) => {
        const value = {
            version,
            necessary: true,
            preferences: Boolean(choices.preferences),
            analytics: Boolean(choices.analytics),
            marketing: Boolean(choices.marketing),
            updatedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {}
        apply(value);
        return value;
    };

    window.VedlikeholdtConsent = { allowed, get: read, save, open: () => openSettings() };

    const existing = read();
    apply(existing);

    const root = document.createElement('div');
    root.className = 'privacy-consent';
    root.innerHTML = `
        <button type="button" class="privacy-settings-button" aria-label="Open privacy choices">Privacy</button>
        <div class="privacy-consent-backdrop" hidden>
            <section class="privacy-consent-card" role="dialog" aria-modal="true" aria-labelledby="privacy-consent-title">
                <div class="privacy-consent-summary">
                    <span class="privacy-consent-icon" aria-hidden="true">✓</span>
                    <div>
                        <h2 id="privacy-consent-title">Your privacy choices</h2>
                        <p>Vedlikeholdt uses necessary browser storage for sign-in and core features. We currently use no analytics or advertising cookies.</p>
                    </div>
                    <div class="privacy-consent-actions">
                        <button type="button" class="privacy-button privacy-button-secondary" data-consent="reject">Reject optional</button>
                        <button type="button" class="privacy-button privacy-button-secondary" data-consent="customize">Customize</button>
                        <button type="button" class="privacy-button privacy-button-primary" data-consent="accept">Accept all</button>
                    </div>
                </div>
                <div class="privacy-consent-customize" hidden>
                    <div class="privacy-consent-heading">
                        <div>
                            <h2>Customize privacy choices</h2>
                            <p>Choose optional storage categories. Necessary storage cannot be disabled.</p>
                        </div>
                        <button type="button" class="privacy-close" data-consent="close" aria-label="Close privacy choices">×</button>
                    </div>
                    <div class="privacy-choice-list">
                        <label class="privacy-choice">
                            <span><strong>Necessary</strong><small>Authentication, security, and saved app data</small></span>
                            <input type="checkbox" checked disabled>
                        </label>
                        <label class="privacy-choice">
                            <span><strong>Preferences</strong><small>Language and interface settings</small></span>
                            <input type="checkbox" name="preferences">
                        </label>
                        <label class="privacy-choice">
                            <span><strong>Analytics</strong><small>Usage measurement; not currently active</small></span>
                            <input type="checkbox" name="analytics">
                        </label>
                        <label class="privacy-choice">
                            <span><strong>Marketing</strong><small>Advertising and cross-site tracking; not currently active</small></span>
                            <input type="checkbox" name="marketing">
                        </label>
                    </div>
                    <div class="privacy-consent-actions">
                        <button type="button" class="privacy-button privacy-button-secondary" data-consent="reject">Reject optional</button>
                        <button type="button" class="privacy-button privacy-button-primary" data-consent="save">Save choices</button>
                    </div>
                </div>
            </section>
        </div>`;
    document.body.appendChild(root);

    const backdrop = root.querySelector('.privacy-consent-backdrop');
    const summary = root.querySelector('.privacy-consent-summary');
    const customize = root.querySelector('.privacy-consent-customize');
    const settingsButton = root.querySelector('.privacy-settings-button');
    const fields = ['preferences', 'analytics', 'marketing'];

    function fillChoices(value) {
        fields.forEach((name) => {
            root.querySelector(`[name="${name}"]`).checked = Boolean(value?.[name]);
        });
    }

    function openSummary() {
        summary.hidden = false;
        customize.hidden = true;
        backdrop.hidden = false;
        settingsButton.hidden = true;
        root.querySelector('[data-consent="reject"]').focus();
    }

    function openSettings() {
        fillChoices(read());
        summary.hidden = true;
        customize.hidden = false;
        backdrop.hidden = false;
        settingsButton.hidden = true;
        root.querySelector('[name="preferences"]').focus();
    }

    function close() {
        backdrop.hidden = true;
        settingsButton.hidden = false;
        settingsButton.focus();
    }

    root.addEventListener('click', (event) => {
        const action = event.target.closest('[data-consent]')?.dataset.consent;
        if (!action) return;
        if (action === 'customize') openSettings();
        if (action === 'close') close();
        if (action === 'accept') {
            save({ preferences: true, analytics: true, marketing: true });
            close();
        }
        if (action === 'reject') {
            save({ preferences: false, analytics: false, marketing: false });
            close();
        }
        if (action === 'save') {
            save(Object.fromEntries(fields.map((name) => [name, root.querySelector(`[name="${name}"]`).checked])));
            close();
        }
    });
    settingsButton.addEventListener('click', openSettings);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !backdrop.hidden && read()) close();
    });

    if (existing) settingsButton.hidden = false;
    else openSummary();
}

function initIntentPrefetch() {
    const prefetched = new Set();
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;

    const pageUrl = (file) => {
        const inPages = location.pathname.includes('/pages/');
        if (file === 'index.html') return inPages ? '../index.html' : 'index.html';
        return inPages ? file : `pages/${file}`;
    };

    const buttonTargets = {
        signin: pageUrl('login.html?mode=signin'),
        signup: pageUrl('login.html?mode=signup'),
        'cta-signup': pageUrl('login.html?mode=signup'),
        'final-cta': pageUrl('login.html?mode=signup'),
        goback: pageUrl('index.html')
    };

    function prefetch(href) {
        if (!href) return;
        let url;
        try {
            url = new URL(href, location.href);
        } catch (_) {
            return;
        }
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
        url.hash = '';
        const key = url.href;
        if (key === location.href.split('#')[0] || prefetched.has(key)) return;
        prefetched.add(key);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = key;
        document.head.appendChild(link);
    }

    function targetHref(target) {
        const element = target instanceof Element ? target.closest('a[href], button, [data-prefetch-href]') : null;
        if (!element) return '';
        if (element.matches('a[href]')) {
            if (element.hasAttribute('download') || element.target === '_blank') return '';
            return element.getAttribute('href');
        }
        return element.dataset.prefetchHref || buttonTargets[element.id] || '';
    }

    const handleIntent = (event) => prefetch(targetHref(event.target));
    document.addEventListener('pointerover', handleIntent, { passive: true });
    document.addEventListener('focusin', handleIntent);
    document.addEventListener('touchstart', handleIntent, { passive: true });
}

const DEFAULT_KNOWN_PAGE_FILES = [
    'index.html',
    'about.html',
    'login.html',
    'dashboard.html',
    'homeowners.html',
    'landlords.html',
    'contractors.html',
    'tools.html',
    'myhomes.html',
    'myneighborhood.html',
    'myvehicles.html',
    'mydocuments.html',
    'myplanning.html',
    'myplanning-calendar.html',
    'myplanning-events.html',
    'myplanning-done.html',
    'mytools.html',
    'mytools 2.html',
    'myprofile.html',
    'coming-soon.html',
    'tool-floorplan.html',
    'myfloorplans.html',
    'myproject.html',
    'terms-of-use.html',
    'privacy-policy.html',
    'vehicle-diagrams.html'
];

const KNOWN_PAGE_FILES = new Set(
    (window.MyMaintenanceConfig && window.MyMaintenanceConfig.knownPageFiles) || DEFAULT_KNOWN_PAGE_FILES
);

function normalizePlaceholderLinks() {
    // coming-soon.html lives in the pages/ directory
    const comingSoonHref = location.pathname.includes('/pages/')
        ? 'coming-soon.html'
        : 'pages/coming-soon.html';

    const shouldRewrite = href => {
        if (!href) return false;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        if (/^https?:\/\//i.test(href)) return false;
        if (href.startsWith('/')) return false;
        const cleanHref = href.split('?')[0].split('#')[0];
        if (!cleanHref.endsWith('.html')) return false;
        const filename = cleanHref.split('/').pop();
        return !KNOWN_PAGE_FILES.has(filename);
    };

    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!shouldRewrite(href)) return;
        const target = encodeURIComponent(href);
        link.setAttribute('href', `${comingSoonHref}?target=${target}`);
    });
}

/* ==================== COMMON LAYOUT (only for logged-in) ==================== */
const COMMON_LAYOUT = {
    header: `
        <header class="navbar">
            <div class="left">
                <a href="dashboard.html" class="brand-link">
                    <svg class="logo" xmlns="http://www.w3.org/2000/svg" height="45" viewBox="0 -960 960 960" width="45">
                        <path d="M480-510ZM240-160q-33 0-56.5-23.5T160-240v-295l-40 31q-13 10-29.5 8T64-512q-10-13-7.5-29T72-567l359-276q11-8 23.5-12t25.5-4q13 0 25.5 4t23.5 12l359 275q13 10 15.5 26t-7.5 30q-10 14-26 15.5t-30-8.5L480-780 240-596v356h81q17 0 28 11.5t11 28.5q0 17-11.5 28.5T320-160h-80Zm357 63q-8 0-15-3t-13-9L456-222q-12-12-12-28t12-28q12-12 28-12t28 12l85 84 198-198q12-12 28.5-11.5T852-391q12 12 12 28t-12 28L625-109q-6 6-13 9t-15 3Z" fill="currentColor"/>
                    </svg>
                    <span class="name">Vedlikeholdt</span>
                </a>
            </div>
            <div class="right">
                <button id="notif-bell" type="button" aria-label="Notifications" title="Notifications">
                    <svg class="notif-icon notif-read" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" aria-hidden="true"><path d="M190-200q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h50v-304q0-84 49.5-150.5T420-798v-22q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v22q81 17 130.5 83.5T720-564v304h50q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H190Zm290-302Zm0 422q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM300-260h360v-304q0-75-52.5-127.5T480-744q-75 0-127.5 52.5T300-564v304Z"/></svg>
                    <svg class="notif-icon notif-unread" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" aria-hidden="true"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80Zm0-422ZM190-200q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h50v-304q0-84 49.5-150.5T420-798v-22q0-25 17.5-42.5T480-880q22.92 0 38.96 14.5T539-830q-12 20-19 42.5t-9 46.5q-8-2-15.28-2.5-7.29-.5-15.72-.5-75 0-127.5 52.5T300-564v304h360v-284q15 3 30 4t30-1v281h50q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H190Zm433-452.12q-32-32.12-32-78T623.12-808q32.12-32 78-32T779-807.88q32 32.12 32 78T778.88-652q-32.12 32-78 32T623-652.12Z"/></svg>
                </button>
                <button id="signout">Sign Out</button>
            </div>
        </header>
    `,
    sidebar: `
        <aside class="sidebar app-sidebar">
            <button type="button" class="app-sidebar-head" aria-expanded="false">
                <span class="app-sidebar-current">MyDashboard</span>
                <svg class="app-sidebar-caret" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <ul class="app-sidebar-menu">
                <li><a href="dashboard.html">MyDashboard</a></li>
                <li><a href="myhomes.html">MyHomes</a></li>
                <li><a href="myneighborhood.html">MyNeighborhood</a></li>
                <li><a href="myvehicles.html">MyVehicles</a></li>
                <li><a href="mydocuments.html">MyDocuments</a></li>
                <li><a href="myplanning.html">MyPlanning</a></li>
                <li><a href="mytools 2.html">MyTools</a></li>
                <li><a href="myprofile.html">MyProfile</a></li>
            </ul>
        </aside>
    `,
    footer: `
        <footer>
            <div class="column"><h3>Social Media</h3><ul><li><a href="https://twitter.com">Twitter</a></li><li><a href="https://facebook.com">Facebook</a></li><li><a href="https://instagram.com">Instagram</a></li></ul></div>
            <div class="column"><h3>Contact Info</h3><p>Email: support@vedlikeholdt.no</p><p>Phone: +1-123-456-7890</p><p>Address: 123 Street, City, Country</p></div>
            <div class="column"><h3>Partners</h3><ul><li><a href="https://partner1.com">Partner 1</a></li><li><a href="https://partner2.com">Partner 2</a></li><li><a href="https://partner3.com">Partner 3</a></li></ul></div>
        </footer>
    `
};

function insertCommonLayout() {
    if (!document.body.classList.contains('logged-in')) return;
    if (document.querySelector('header.navbar')) return; // already has header (old HTML) → skip to avoid duplicates

    const h = document.createElement('div'); h.innerHTML = COMMON_LAYOUT.header.trim(); document.body.prepend(h.firstElementChild);
    const s = document.createElement('div'); s.innerHTML = COMMON_LAYOUT.sidebar.trim(); document.querySelector('header.navbar').after(s.firstElementChild);

    // Full-screen tools (e.g. the floor plan maker) skip the footer so they
    // can fill the viewport below the navbar and sidebar.
    const pageFile = decodeURIComponent(location.pathname.split('/').pop() || '');
    if (!/^tool-/.test(pageFile)) {
        const f = document.createElement('div'); f.innerHTML = COMMON_LAYOUT.footer.trim(); document.body.appendChild(f.firstElementChild);
    }

    setActiveSidebarLink();
    initAppSidebar();
}

function initAppSidebar() {
    const sb = document.querySelector('.app-sidebar');
    if (!sb) return;
    const head = sb.querySelector('.app-sidebar-head');
    const current = sb.querySelector('.app-sidebar-current');

    const file = decodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
    if (current) {
        const isTool = /^(mytools|tool-)/.test(file);
        let link = isTool
            ? sb.querySelector('.app-sidebar-menu a[href^="mytools"]')
            : sb.querySelector('.app-sidebar-menu a[href="' + file + '"]');
        current.textContent = link ? link.textContent : 'MyDashboard';
    }

    if (head) {
        head.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = sb.classList.toggle('open');
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    document.addEventListener('click', (e) => {
        if (!sb.contains(e.target)) {
            sb.classList.remove('open');
            if (head) head.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            sb.classList.remove('open');
            if (head) head.setAttribute('aria-expanded', 'false');
        }
    });
}

function setActiveSidebarLink() {
    const current = decodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
    const isToolArea = /^(mytools|tool-)/.test(current);
    document.querySelectorAll('.sidebar a').forEach(a => {
        const href = decodeURIComponent(a.getAttribute('href'));
        a.classList.toggle('active', href === current || (isToolArea && /^mytools/.test(href)));
    });
}

/* ==================== NOTIFICATIONS ==================== */
const NOTIF_STORAGE_KEY = 'mymaintenance_notif_items';
let notifShowingPrevious = false;
let notifSelectionMode = false;
let notifSelected = new Set();
let notifItems = null;
function notifLoad() {
    if (Array.isArray(notifItems)) return notifItems;
    try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY)) || []; } catch (_) { return []; }
}
function notifSave(items) {
    notifItems = items;
    try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(items)); } catch (_) {}
}
async function notifHydrateCloud() {
    if (!window.MyMaintenanceAuth || !window.MyMaintenanceData) return;
    try {
        const result = await window.MyMaintenanceAuth.familyRequest('notifications');
        notifItems = (result.notifications || []).map(function (n) {
            return Object.assign({}, n, {
                read: Boolean(n.read_at),
                invitationKind: n.kind === 'neighborhood_invitation' ? 'neighborhood' : (n.kind === 'family_invitation' ? 'family' : '')
            });
        });
        try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifItems)); } catch (_) {}
        notifRenderList();
        notifRenderIcon();
    } catch (error) {
        console.warn('Could not load notifications:', error);
    }
}
async function notifUpdateCloud(notification, read) {
    if (!notification || !notification.id || !window.MyMaintenanceData) return;
    try {
        await window.MyMaintenanceData.request('notifications?id=eq.' + notification.id, {
            method: 'PATCH',
            body: { read_at: read ? new Date().toISOString() : null },
            prefer: 'return=minimal'
        });
    } catch (error) { console.warn('Could not update notification:', error); }
}
async function notifDeleteCloud(notification) {
    if (!notification || !notification.id || !window.MyMaintenanceData) return;
    try {
        await window.MyMaintenanceData.request('notifications?id=eq.' + notification.id, { method: 'DELETE' });
    } catch (error) { console.warn('Could not delete notification:', error); }
}
async function notifInvitationAction(notification, action) {
    if (!notification || !notification.reference_id || !window.MyMaintenanceAuth) return;
    try {
        const requestAction = action === 'accept' && notification.invitationKind === 'neighborhood'
            ? 'accept-neighborhood'
            : action;
        await window.MyMaintenanceAuth.familyRequest(requestAction, {
            id: notification.reference_id,
            kind: notification.invitationKind
        });
        await notifDeleteCloud(notification);
        notifItems = notifLoad().filter(function (item) { return item.id !== notification.id; });
        notifSave(notifItems);
        notifRenderList();
        notifRenderIcon();
    } catch (error) {
        if (window.MyMaintenanceCommonUi) window.MyMaintenanceCommonUi.alert(error.message || 'Could not update the invitation.');
    }
}
function notifUnread(items) {
    return (items || notifLoad()).filter(function (n) { return !n.read; }).length;
}
function notifRenderIcon() {
    const bell = document.getElementById('notif-bell');
    if (!bell) return;
    const unread = notifUnread();
    bell.classList.toggle('has-unread', unread > 0);
}
function notifRenderList() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const items = notifLoad();
    const visibleItems = items.filter(function (n) { return notifShowingPrevious ? n.read : !n.read; });
    if (!visibleItems.length) {
        list.innerHTML = '<p class="notif-empty">' + (notifShowingPrevious ? 'No previous notifications.' : 'No new notifications.') + '</p>';
        return;
    }
    list.innerHTML = visibleItems.map(function (n) {
        const index = items.indexOf(n);
        const when = n.at || n.created_at ? new Date(n.at || n.created_at) : null;
        const label = when ? when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const invitationActions = !notifSelectionMode && n.invitationKind
            ? '<div class="notif-item-actions"><button type="button" class="notif-action accept" data-notif-action="accept">Accept</button><button type="button" class="notif-action reject" data-notif-action="reject">Reject</button></div>'
            : '';
        return '<div class="notif-item' + (n.read ? ' read' : '') + (notifSelected.has(index) ? ' selected' : '') + '" data-i="' + index + '">'
            + (notifSelectionMode ? '<span class="notif-select-mark" aria-hidden="true">' + (notifSelected.has(index) ? '&#10003;' : '') + '</span>' : '')
            + '<div class="notif-item-main"><strong>' + String(n.title || 'Notification') + '</strong>'
            + '<p>' + String(n.body || '') + '</p>' + invitationActions + '</div>'
            + (label ? '<span class="notif-item-time">' + label + '</span>' : '')
            + '</div>';
    }).join('');
    list.querySelectorAll('.notif-item[data-i]').forEach(function (el) {
        el.addEventListener('click', function (event) {
            const idx = Number(el.getAttribute('data-i'));
            const items = notifLoad();
            const actionButton = event.target.closest('.notif-action');
            if (actionButton && items[idx]) {
                event.stopPropagation();
                notifInvitationAction(items[idx], actionButton.dataset.notifAction);
                return;
            }
            if (notifSelectionMode) {
                if (notifSelected.has(idx)) notifSelected.delete(idx);
                else notifSelected.add(idx);
                notifRenderList();
                notifRenderControls();
                return;
            }
            if (!items[idx] || items[idx].read) return;
            items[idx].read = true;
            notifSave(items);
            notifUpdateCloud(items[idx], true);
            notifRenderList();
            notifRenderIcon();
        });
    });
}
function notifRenderControls() {
    const selectBtn = document.getElementById('notif-select');
    const deleteBtn = document.getElementById('notif-delete');
    const unreadBtn = document.getElementById('notif-unread');
    const cancelBtn = document.getElementById('notif-selection-cancel');
    const previousBtn = document.getElementById('notif-previous');
    const closeBtn = document.getElementById('notif-close');
    if (!selectBtn || !deleteBtn || !unreadBtn || !cancelBtn) return;
    selectBtn.hidden = notifSelectionMode;
    previousBtn.hidden = notifSelectionMode;
    closeBtn.hidden = notifSelectionMode;
    deleteBtn.hidden = !notifSelectionMode;
    unreadBtn.hidden = !notifSelectionMode;
    cancelBtn.hidden = !notifSelectionMode;
    deleteBtn.disabled = notifSelected.size === 0;
    unreadBtn.disabled = notifSelected.size === 0;
}
function initNotifications() {
    const bell = document.getElementById('notif-bell');
    if (!bell) return;

    // Popup markup
    if (!document.getElementById('notif-popup')) {
        const ov = document.createElement('div');
        ov.className = 'popup-overlay notif-overlay';
        ov.id = 'notif-popup';
        ov.innerHTML = '<div class="popup-content notif-popup">'
            + '<h3>Notifications</h3>'
            + '<div id="notif-list" class="notif-list"></div>'
            + '<div class="popup-buttons">'
            + '<button type="button" class="popup-btn cancel" id="notif-close">Close</button>'
            + '<button type="button" class="popup-btn cancel" id="notif-previous">Previous notifications</button>'
            + '<button type="button" class="popup-btn cancel" id="notif-select">Select</button>'
            + '<button type="button" class="popup-btn confirm" id="notif-delete" hidden>Delete</button>'
            + '<button type="button" class="popup-btn confirm" id="notif-unread" hidden>Set unread</button>'
            + '<button type="button" class="popup-btn cancel" id="notif-selection-cancel" hidden>Cancel</button>'
            + '</div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.style.display = 'none'; });
    }
    const popup = document.getElementById('notif-popup');
    const selectBtn = document.getElementById('notif-select');
    const deleteBtn = document.getElementById('notif-delete');
    const unreadBtn = document.getElementById('notif-unread');
    const selectionCancelBtn = document.getElementById('notif-selection-cancel');
    const closeBtn = document.getElementById('notif-close');
    const previousBtn = document.getElementById('notif-previous');

    bell.addEventListener('click', function (e) {
        e.stopPropagation();
        notifShowingPrevious = false;
        notifSelectionMode = false;
        notifSelected.clear();
        notifRenderList();
        notifRenderControls();
        popup.style.display = 'flex';
    });
    if (selectBtn) selectBtn.addEventListener('click', function () {
        notifSelectionMode = true;
        notifSelected.clear();
        notifRenderList();
        notifRenderControls();
    });
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
        if (!notifSelected.size) return;
        const selected = notifLoad().filter(function (_, index) { return notifSelected.has(index); });
        selected.forEach(notifDeleteCloud);
        notifSave(notifLoad().filter(function (_, index) { return !notifSelected.has(index); }));
        notifSelectionMode = false;
        notifSelected.clear();
        notifRenderList();
        notifRenderControls();
        notifRenderIcon();
    });
    if (unreadBtn) unreadBtn.addEventListener('click', function () {
        if (!notifSelected.size) return;
        const items = notifLoad();
        notifSelected.forEach(function (index) {
            if (items[index]) {
                items[index].read = false;
                notifUpdateCloud(items[index], false);
            }
        });
        notifSave(items);
        notifSelectionMode = false;
        notifSelected.clear();
        notifShowingPrevious = false;
        notifRenderList();
        notifRenderControls();
        notifRenderIcon();
    });
    if (selectionCancelBtn) selectionCancelBtn.addEventListener('click', function () {
        notifSelectionMode = false;
        notifSelected.clear();
        notifRenderList();
        notifRenderControls();
    });
    if (previousBtn) previousBtn.addEventListener('click', function () {
        notifShowingPrevious = !notifShowingPrevious;
        previousBtn.textContent = notifShowingPrevious ? 'New notifications' : 'Previous notifications';
        notifRenderList();
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { popup.style.display = 'none'; });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && popup.style.display === 'flex') {
            e.preventDefault();
            notifSelectionMode = false;
            notifSelected.clear();
            popup.style.display = 'none';
        }
    });

    notifRenderControls();
    notifRenderIcon();
    notifHydrateCloud();
}

/* ==================== MAIN SCRIPT ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initPrivacyConsent();
    initIntentPrefetch();
    normalizePlaceholderLinks();
    if (window.MyMaintenanceAuth && typeof window.MyMaintenanceAuth.enforceAuthRouting === 'function') {
        window.MyMaintenanceAuth.enforceAuthRouting();
    }
    insertCommonLayout();

    initNotifications();

    // Language button on EVERY page (including index.html)
    const navbarRight = document.querySelector('.navbar .right');
    if (navbarRight && !document.getElementById('lang-toggle')) {
        const langBtn = document.createElement('button');
        langBtn.id = 'lang-toggle';
        navbarRight.appendChild(langBtn);
    }

    currentLang = window.VedlikeholdtConsent.allowed('preferences') ? (localStorage.getItem('lang') || 'en') : 'en';
    document.documentElement.lang = currentLang;

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'en' ? 'no' : 'en';
            currentLang = newLang;
            if (window.VedlikeholdtConsent.allowed('preferences')) localStorage.setItem('lang', newLang);
            document.documentElement.lang = newLang;
            translateAll();
            langToggle.textContent = newLang.toUpperCase();
        });
    }

    // === YOUR ORIGINAL FUNCTIONS (initDataKeys + translateAll) ===
    function initDataKeys() {
        document.querySelectorAll('.sidebar a, footer h3, main h1, main h2, .profile-info strong, .profile-button, .dash-box h3, .dash-box p, .button-group button, .add-button, #signin, #signup, #signout, #goback, .subgroup h4, .doc-row span, .dropdown-toggle span, .dropdown-menu button, .auth-container h1, .overlay-panel h1, .ghost, .terms-link, .overlay-text h2, .btn, .btn-cta, .cta-hero h2, .cta-hero p, .cta-final h2, .cta-final p, .section-header-alt h2, .section-header-alt p, .value-card strong, .value-card p, .customer-cta .btn, .hero-content h1, .hero-sub, .showcase-text h2, .showcase-text p, .cta-banner h2, .cta-banner p').forEach(el => {
            if (!el.dataset.key) el.dataset.key = el.textContent.trim();
        });
        document.querySelectorAll('footer p').forEach(p => {
            const text = p.textContent.trim();
            if (text.startsWith('Email:')) p.dataset.key = 'Email:';
            else if (text.startsWith('Phone:')) p.dataset.key = 'Phone:';
            else if (text.startsWith('Address:')) p.dataset.key = 'Address:';
        });
    }

    function translateAll() {
        const lang = currentLang;
        document.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            if (!translations[key] || !translations[key][lang]) return;
            if (['Email:', 'Phone:', 'Address:'].includes(key) && el.closest('footer')) {
                const valuePart = el.textContent.split(':')[1] || '';
                el.textContent = translations[key][lang] + ':' + valuePart;
                return;
            }
            if (el.tagName === 'INPUT') el.placeholder = translations[key][lang];
            else el.textContent = translations[key][lang];
        });
    }

    window.addEventListener('vedlikeholdt:consentchange', (event) => {
        if (event.detail?.preferences) {
            localStorage.setItem('lang', currentLang);
        } else {
            localStorage.removeItem('lang');
            currentLang = 'en';
            document.documentElement.lang = currentLang;
            translateAll();
            if (langToggle) langToggle.textContent = currentLang.toUpperCase();
        }
    });

    initDataKeys();
    translateAll();
    if (langToggle) langToggle.textContent = currentLang.toUpperCase();

    // === YOUR ORIGINAL CODE (sidebar toggle, dropdowns, photo gallery, signout listener, etc.) ===
    const body = document.body;

    const sidebarToggle = document.getElementById('sidebar-toggle');
    let lastSidebarToggle = 0;
    function toggleSidebar() {
        body.classList.toggle('sidebar-open');
        lastSidebarToggle = Date.now();
    }
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

    let lastScroll = 0;
    const scrollTarget = window;
    scrollTarget.addEventListener('scroll', () => {
        const currentScroll = window.scrollY || document.documentElement.scrollTop;
        const hasToggle = !!document.getElementById('sidebar-toggle');
        const isLoggedIn = body.classList.contains('logged-in');
        if (currentScroll > lastScroll) {
            // Don't instantly close a sidebar the user just opened via the toggle
            // (a scroll event right after the tap can otherwise undo it).
            if (Date.now() - lastSidebarToggle > 400 && hasToggle && !isLoggedIn && body.classList.contains('sidebar-open')) toggleSidebar();
            if (!isLoggedIn && currentScroll > 50 && !body.classList.contains('shrunk')) body.classList.add('shrunk');
        } else {
            if (!isLoggedIn && body.classList.contains('shrunk')) body.classList.remove('shrunk');
        }
        if (!isLoggedIn && currentScroll === 0) body.classList.remove('shrunk');
        lastScroll = currentScroll;
    });

    if (window.MyMaintenanceAuth && typeof window.MyMaintenanceAuth.initAuthInteractions === 'function') {
        window.MyMaintenanceAuth.initAuthInteractions();
    }

    if (window.MyMaintenanceCommonUi && typeof window.MyMaintenanceCommonUi.initCommonUiInteractions === 'function') {
        window.MyMaintenanceCommonUi.initCommonUiInteractions();
    }

    // === RESPONSIVE NAVBAR: on narrow screens "Sign Up" is hidden by CSS and
    // the Sign In button is relabeled to "Sign in/up" so both actions stay reachable. ===
    function updateMarketingNavbar() {
        const signin = document.getElementById('signin');
        const signup = document.getElementById('signup');
        if (!signin || !signup) return;
        if (document.body.classList.contains('logged-in')) return;
        const narrow = window.innerWidth <= 560;
        signup.style.display = narrow ? 'none' : '';
        if (narrow) {
            signin.dataset.key = 'Sign in/up';
            signin.textContent = (translations['Sign in/up'] && translations['Sign in/up'][currentLang]) || 'Sign In/Up';
        } else {
            signin.dataset.key = 'Sign In';
            signin.textContent = translations['Sign In'][currentLang];
        }
    }
    updateMarketingNavbar();
    window.addEventListener('resize', updateMarketingNavbar);

});
