const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serves your HTML

// Connect to MongoDB
// Connect to MongoDB (Updated for Mongoose 8+)
mongoose.connect('mongodb://127.0.0.1:27017/batch_scheduler')
    .then(() => console.log('MongoDB Connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// 1. Box Schema (Parent)
const BoxSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sector: { type: String, required: true } 
});
const Box = mongoose.model('Box', BoxSchema);

// 2. Job Schema (Child referencing Box)
const JobSchema = new mongoose.Schema({
    jobId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' }, 
    region: String,
    abap: String,
    schedule: String,
    dependency: String,
    flagged: { type: Boolean, default: false },
    flagMessage: { type: String, default: "" },
    rule: {
        frequency: String,
        days: [Number],
        day: Number,
        n: mongoose.Schema.Types.Mixed,
        time: String,
        utc_offset: String 
    }
});
const Job = mongoose.model('Job', JobSchema);

// --- REST API CRUD OPERATIONS ---

// READ: Fetch all jobs for a sector
app.get('/api/jobs', async (req, res) => {
    try {
        const sector = req.query.sector || 'beauty';
        const validBoxes = await Box.find({ sector }).select('_id');
        const boxIds = validBoxes.map(b => b._id);

        const jobs = await Job.find({ box: { $in: boxIds } }).populate('box').lean();
        
        // Flatten payload for the frontend
        const payload = jobs.map(job => ({
            ...job,
            id: job.jobId,
            box: job.box ? job.box.name : 'Unknown Box'
        }));
        
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE: Add a new job
app.post('/api/jobs', async (req, res) => {
    try {
        const data = req.body;
        const sector = data.sector || 'beauty';
        
        let boxDoc = await Box.findOne({ name: data.box, sector });
        if (!boxDoc) boxDoc = await Box.create({ name: data.box, sector });
        
        const newJob = await Job.create({
            jobId: data.id, name: data.name, box: boxDoc._id, 
            region: data.region, abap: data.abap, schedule: data.schedule, 
            dependency: data.dependency, rule: data.rule,
            flagged: false, flagMessage: ""
        });
        res.status(201).json(newJob);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE: Edit an existing job or update flag status
app.put('/api/jobs/:id', async (req, res) => {
    try {
        const data = req.body;
        let updatePayload = { ...data };

        // Handle Box updates if the box name changed
        if (data.box) {
            const sector = data.sector || 'beauty';
            let boxDoc = await Box.findOne({ name: data.box, sector });
            if (!boxDoc) boxDoc = await Box.create({ name: data.box, sector });
            updatePayload.box = boxDoc._id;
        }

        await Job.findOneAndUpdate({ jobId: req.params.id }, updatePayload);
        res.json({ message: 'Job updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove a job
app.delete('/api/jobs/:id', async (req, res) => {
    try {
        await Job.findOneAndDelete({ jobId: req.params.id });
        res.json({ message: 'Job deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));