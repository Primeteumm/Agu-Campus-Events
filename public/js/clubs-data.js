// clubs-data.js
// Shared mock data for clubs (Ghost Identities)
const CLUBS = {
    'nebula-tech': {
        id: 'nebula-tech',
        name: 'Nebula Tech Society',
        tagline: "Exploring the outer limits of innovation.",
        category: '💻 Technology',
        memberCount: 142,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=NT&background=003344&color=00F2FF&size=256&bold=true',
        about: [
            'Nebula Tech Society is the leading technology community at Abdullah Gül University. We bring together students passionate about software development, AI, hardware, and emerging technologies.',
            'Our weekly workshops, hackathons, and speaker sessions provide hands-on experience with cutting-edge tools. Whether you\'re a beginner or an expert, there\'s a place for you in our community.',
            'We collaborate with industry partners to offer internship opportunities, project mentoring, and career networking events throughout the academic year.',
        ],
        highlights: [
            { icon: '🏆', title: 'Hackathon Winners', desc: '3x national hackathon champions (2023–2025)' },
            { icon: '🤝', title: 'Industry Partners', desc: '12+ tech companies collaborate with us' },
            { icon: '📚', title: 'Weekly Workshops', desc: 'Hands-on sessions every Wednesday' },
            { icon: '🚀', title: 'Startup Incubation', desc: '5 startups founded by our members' },
        ],
        team: [
            { name: 'Muhammed Ali Bakır', role: 'President',      initials: 'MB', color: '003344&color=00F2FF' },
            { name: 'Enes Aydın',         role: 'Vice President', initials: 'EA', color: '1a0a0a&color=FF6B6B' },
            { name: 'Mustafa Ateş',       role: 'Tech Lead',      initials: 'MA', color: '0d1a00&color=66FF66' },
        ],
    },
    'echo-arts': {
        id: 'echo-arts',
        name: 'Echo Arts Collective',
        tagline: 'Where every color tells a story.',
        category: '🎵 Music & Arts',
        memberCount: 98,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=EA&background=1a0a1a&color=FF6B6B&size=256&bold=true',
        about: [
            'The Echo Arts Collective is a vibrant community of musicians, composers, and artists at Abdullah Gül University. We welcome all genres and skill levels.',
            'From classical concerts to jazz nights and electronic music production workshops, we create diverse musical experiences for the entire campus.',
        ],
        highlights: [
            { icon: '🎸', title: 'Live Concerts', desc: 'Monthly campus performances' },
            { icon: '🎹', title: 'Rehearsal Rooms', desc: 'Dedicated practice spaces' },
            { icon: '🎤', title: 'Open Mic Nights', desc: 'Every Friday evening' },
            { icon: '🎼', title: 'Composition Lab', desc: 'Music production workshops' },
        ],
        team: [
            { name: 'Muhammed Ali Bakır', role: 'President',      initials: 'MB', color: '1a0a1a&color=FF6B6B' },
            { name: 'Enes Aydın',         role: 'Conductor',      initials: 'EA', color: '0a001a&color=CC88FF' },
            { name: 'Mustafa Ateş',       role: 'Events Lead',    initials: 'MA', color: '001a0a&color=00FFAA' },
        ],
    },
    'nova-coding': {
        id: 'nova-coding',
        name: 'Nova Coding Guild',
        tagline: 'Forging the code of tomorrow.',
        category: '💻 Software',
        memberCount: 210,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=NC&background=0a1a0a&color=66FF66&size=256&bold=true',
        about: ['A community for hardcore developers and algorithm enthusiasts.'],
        highlights: [],
        team: []
    },
    'zenith-adventure': {
        id: 'zenith-adventure',
        name: 'Zenith Adventure Club',
        tagline: 'Reach the peak.',
        category: '⛰️ Outdoors',
        memberCount: 75,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=ZA&background=1a1000&color=FFD700&size=256&bold=true',
        about: ['Outdoor adventures and nature hikes.'],
        highlights: [],
        team: []
    }
};

// Helper function to map organizer name to a club ID
function getClubIdFromName(organizerName) {
    if (!organizerName) return null;
    const nameStr = organizerName.toLowerCase();
    
    for (const key in CLUBS) {
        const club = CLUBS[key];
        const keyword = club.name.replace(' Society', '').replace(' Collective', '').replace(' Guild', '').replace(' Club', '').toLowerCase();
        if (nameStr.includes(keyword) || club.name.toLowerCase() === nameStr) {
            return club.id;
        }
    }
    return null;
}
