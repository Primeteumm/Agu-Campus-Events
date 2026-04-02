const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


const { supabase } = require('./supabase'); 


const app = express();


app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, async () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        
        
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Supabase bağlantı hatası:', error.message);
        } else {
            console.log('✅ Supabase bağlantısı başarılı! AGU Campus Events hazır.');
        }
    });
}

module.exports = app;