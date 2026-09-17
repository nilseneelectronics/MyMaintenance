/* Defaults for a new neighborhood, without changing saved profile or home data. */
window.MyMaintenanceNeighborhoodDefaults = (function () {
    function normalize(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    // Turn a street address into a neighborhood name: drop the street number
    // (e.g. "Mountain Road 45" -> "Mountain Road", "Street 123B" -> "Street").
    function streetName(address) {
        const text = String(address || '').trim();
        return text.replace(/\s*\d+[a-z]?\s*$/i, '').trim() || text;
    }

    function create(profile, homes, family) {
        profile = profile || {};
        family = Array.isArray(family) ? family : [];
        const owner = family.find(member => normalize(member.email) === normalize(profile.email) && profile.email);
        const eligible = (homes || []).filter(home => normalize(home.address) &&
            (!home.ownerId || home.ownerId === profile.id || (owner && home.ownerId === owner.id)));
        const home = eligible.find(home => normalize(home.houseType) === 'house') ||
            eligible.find(home => normalize(home.houseType) === 'apartment') || eligible[0];
        if (!home) return null;

        const creator = { userId: profile.id || '', name: profile.name || '', email: profile.email || '', phone: profile.phone || '', role: 'admin' };
        const people = [creator];
        const seen = new Set([normalize(creator.email)].filter(Boolean));
        family.forEach(member => {
            if (!['active', 'accepted', 'connected'].includes(normalize(member.status))) return;
            if (!normalize(member.address) || normalize(member.address) !== normalize(home.address)) return;
            if (['country', 'zip', 'city'].some(field => normalize(member[field]) && normalize(home[field]) &&
                normalize(member[field]) !== normalize(home[field]))) return;
            const email = normalize(member.email);
            if (!email || seen.has(email)) return;
            seen.add(email);
            people.push({ name: member.name || '', email: member.email, phone: member.phone || '', role: 'view' });
        });
        return {
            id: null, name: streetName(home.address), other: '', country: home.country || '', zip: home.zip || '', city: home.city || '',
            addresses: [{ id: 'home_' + home.id, homeId: home.id, address: home.address, people: people }]
        };
    }
    return { create: create };
})();
