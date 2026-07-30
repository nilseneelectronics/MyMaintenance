/* script.js - COMPLETE FIXED VERSION (language on index.html + Sign Out on all logged-in pages) */

const translations = {
    // Navbar buttons
    "Sign Out": { en: "Sign Out", no: "Logg ut" },
    "Sign In": { en: "Sign In", no: "Logg inn" },
    "Sign Up": { en: "Sign Up", no: "Registrer deg" },
    "Go Back": { en: "Go Back", no: "Gå tilbake" },

    // Sidebar + headers
    "MyDashboard": { en: "MyDashboard", no: "Mitt Dashbord" },
    "MyHomes": { en: "MyHomes", no: "Mine Hjem" },
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

const DEFAULT_KNOWN_PAGE_FILES = [
    'index.html',
    'about.html',
    'login.html',
    'dashboard.html',
    'myhomes.html',
    'myvehicles.html',
    'mydocuments.html',
    'myplanning.html',
    'mytools.html',
    'myprofile.html',
    'coming-soon.html',
    'tool-floorplan.html',
    'tool-kitchen.html',
    'tool-bathroom.html',
    'tool-living.html',
    'tool-garden.html',
    'tool-garage.html'
];

const KNOWN_PAGE_FILES = new Set(
    (window.MyMaintenanceConfig && window.MyMaintenanceConfig.knownPageFiles) || DEFAULT_KNOWN_PAGE_FILES
);

function normalizePlaceholderLinks() {
    const shouldRewrite = href => {
        if (!href) return false;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        if (/^https?:\/\//i.test(href)) return false;
        if (href.startsWith('/')) return false;
        const cleanHref = href.split('?')[0].split('#')[0];
        if (!cleanHref.endsWith('.html')) return false;
        return !KNOWN_PAGE_FILES.has(cleanHref);
    };

    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!shouldRewrite(href)) return;
        const target = encodeURIComponent(href);
        link.setAttribute('href', `coming-soon.html?target=${target}`);
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
                    <span class="name">MyMaintenance</span>
                </a>
            </div>
            <div class="right">
                <button id="signout">Sign Out</button>
            </div>
        </header>
    `,
    sidebar: `
        <aside class="sidebar">
            <ul>
                <li><a href="dashboard.html">MyDashboard</a></li>
                <li><a href="myhomes.html">MyHomes</a></li>
                <li><a href="myvehicles.html">MyVehicles</a></li>
                <li><a href="mydocuments.html">MyDocuments</a></li>
                <li><a href="myplanning.html">MyPlanning</a></li>
                <li><a href="mytools.html">MyTools</a></li>
                <li><a href="myprofile.html">MyProfile</a></li>
            </ul>
        </aside>
    `,
    footer: `
        <footer>
            <div class="column"><h3>Social Media</h3><ul><li><a href="https://twitter.com">Twitter</a></li><li><a href="https://facebook.com">Facebook</a></li><li><a href="https://instagram.com">Instagram</a></li></ul></div>
            <div class="column"><h3>Contact Info</h3><p>Email: info@mymaintenance.com</p><p>Phone: +1-123-456-7890</p><p>Address: 123 Street, City, Country</p></div>
            <div class="column"><h3>Partners</h3><ul><li><a href="https://partner1.com">Partner 1</a></li><li><a href="https://partner2.com">Partner 2</a></li><li><a href="https://partner3.com">Partner 3</a></li></ul></div>
        </footer>
    `
};

function insertCommonLayout() {
    if (!document.body.classList.contains('logged-in')) return;
    if (document.querySelector('header.navbar')) return; // already has header (old HTML) → skip to avoid duplicates

    const h = document.createElement('div'); h.innerHTML = COMMON_LAYOUT.header.trim(); document.body.prepend(h.firstElementChild);
    const s = document.createElement('div'); s.innerHTML = COMMON_LAYOUT.sidebar.trim(); document.querySelector('header.navbar').after(s.firstElementChild);
    const f = document.createElement('div'); f.innerHTML = COMMON_LAYOUT.footer.trim(); document.body.appendChild(f.firstElementChild);

    setActiveSidebarLink();
}

function setActiveSidebarLink() {
    const current = location.pathname.split('/').pop() || 'dashboard.html';
    const isToolPage = /^tool-/.test(current);
    document.querySelectorAll('.sidebar a').forEach(a => {
        const href = a.getAttribute('href');
        a.classList.toggle('active', href === current || (isToolPage && href === 'mytools.html'));
    });
}

/* ==================== MAIN SCRIPT ==================== */
document.addEventListener('DOMContentLoaded', () => {
    normalizePlaceholderLinks();
    if (window.MyMaintenanceAuth && typeof window.MyMaintenanceAuth.enforceAuthRouting === 'function') {
        window.MyMaintenanceAuth.enforceAuthRouting();
    }
    insertCommonLayout();

    // Language button on EVERY page (including index.html)
    const navbarRight = document.querySelector('.navbar .right');
    if (navbarRight && !document.getElementById('lang-toggle')) {
        const langBtn = document.createElement('button');
        langBtn.id = 'lang-toggle';
        navbarRight.appendChild(langBtn);
    }

    currentLang = localStorage.getItem('lang') || 'en';
    document.documentElement.lang = currentLang;

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'en' ? 'no' : 'en';
            currentLang = newLang;
            localStorage.setItem('lang', newLang);
            document.documentElement.lang = newLang;
            translateAll();
            langToggle.textContent = newLang.toUpperCase();
        });
    }

    // === YOUR ORIGINAL FUNCTIONS (initDataKeys + translateAll) ===
    function initDataKeys() {
        document.querySelectorAll('.sidebar a, footer h3, main h1, main h2, .profile-info strong, .profile-button, .dash-box h3, .dash-box p, .button-group button, .add-button, #signin, #signup, #signout, #goback, .subgroup h4, .doc-row span, .dropdown-toggle span, .dropdown-menu button, .auth-container h1, .overlay-panel h1, .ghost, .terms-link, .btn, .cta-final h2, .cta-final p, .hero-content h1, .hero-sub, .showcase-text h2, .showcase-text p').forEach(el => {
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

    initDataKeys();
    translateAll();
    if (langToggle) langToggle.textContent = currentLang.toUpperCase();

    // === YOUR ORIGINAL CODE (sidebar toggle, dropdowns, photo gallery, signout listener, etc.) ===
    const body = document.body;

    const sidebarToggle = document.getElementById('sidebar-toggle');
    function toggleSidebar() { body.classList.toggle('sidebar-open'); }
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        const hasToggle = !!document.getElementById('sidebar-toggle');
        const isLoggedIn = body.classList.contains('logged-in');
        if (currentScroll > lastScroll) {
            if (hasToggle && !isLoggedIn && body.classList.contains('sidebar-open')) toggleSidebar();
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

});
