window.MyMaintenanceConfig = {
    authTokenKey: 'mymaintenance.authToken',
    apiBaseUrl: 'http://localhost:3000',
    // Optional same-origin backend route. When set, the receipt scanner sends only
    // its proposed store name and the first receipt lines for verification.
    receiptStoreVerificationUrl: '',
    loggedInPages: [
        'dashboard.html',
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
        'myprofile.html'
    ],
    publicOnlyPages: ['login.html'],
    knownPageFiles: [
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
        'tool-floorplan.html',
        'coming-soon.html'
    ]
};
