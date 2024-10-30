const express = require('express');
const { v4: uuidv4 } = require('uuid'); // Install uuid using npm

const mongoose = require('mongoose');
const multer = require('multer');
const axios = require('axios'); // To communicate with storage nodes

const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const fs = require('fs');
var mv = require('mv');

const app = express();

const path = require('path');


app.use(express.json()); // Ensure JSON parsing is enabled
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
const storage = multer.memoryStorage();
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // Limit set to 10 MB (adjust as needed)
});

// MongoDB connection
mongoose.connect('mongodb+srv://admin:12345@storagedistribution.hjtwm.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Define a simple schema for accounts
const TransactionSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true },
    storageBought: { type: Number, required: true },
    totalSpent: { type: Number, required: true }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const originalFilename = req.file.originalname; // The original filename
    const uniqueId = uuidv4(); // Generate a unique ID for the file
    const filePath = path.join(__dirname, req.file.path);
    const outputDir = path.join(__dirname, 'uploads', 'fragments', uniqueId); // Use unique ID as directory name

    // Create a directory for the fragments
    fs.mkdirSync(outputDir, { recursive: true });

    // Spawn Python process to encrypt and fragment
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

const pythonProcess = spawn(pythonCmd, [
    path.join(__dirname, 'storage_backend.py'),
    filePath,
    outputDir,
]);

    // Log Python output
    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python output: ${data}`);
    });

    // Handle Python errors
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
    });

    // Handle completion
    pythonProcess.on('close', async (code) => {
        if (code === 0) {
            const fragments = fs.readdirSync(outputDir);
            const promises = fragments.map(fragment => {
                const fragmentPath = path.join(outputDir, fragment);
                return distributeFragment(fragment, fragmentPath);
            });

            await Promise.all(promises);
            res.json({
                message: 'File uploaded, encrypted, fragmented, and distributed successfully.',
                filename: uniqueId, // Return the unique filename for reference
                originalFilename: originalFilename // Optionally return the original filename
            })
                } else {
            res.status(500).send('Failed to process file.');
        }

        // Optionally, delete the original uploaded file after processing
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete original file: ${err}`);
        });
    });

    
});

const distributeFragment = async (filename, fragmentPath) => {
    // Replace with the actual addresses of other nodes
    const nodes = [
        'http://192.168.1.125:3000/store',
        'http://192.168.1.130:3000/store'
    ];

    const fragmentData = fs.readFileSync(fragmentPath);
    const base64Data = fragmentData.toString('base64');

    // Send fragment to each node
    const promises = nodes.map(async (nodeUrl) => {
        try {
            await axios.post(nodeUrl, {
                filename: filename,
                data: base64Data
            });
            console.log(`Fragment ${filename} distributed to ${nodeUrl}`);
        } catch (error) {
            console.error(`Error distributing fragment ${filename} to ${nodeUrl}:`, error);
        }
    });

    await Promise.all(promises);
};

// Endpoint for storage nodes to store fragments
app.post('/store', (req, res) => {
    const { filename, data } = req.body;

    // Save the file fragment to the local file system
    const fragmentPath = path.join(__dirname, 'uploads', 'fragments', filename);
    fs.writeFileSync(fragmentPath, Buffer.from(data, 'base64'));
    console.log(`Stored fragment: ${filename}`);
    res.send('Fragment stored successfully!');
});

// Endpoint to retrieve fragments and reassemble file
app.post('/retrieve', async (req, res) => {
    const { filename, nodeAddresses } = req.body;
    const fragmentPaths = [];

    for (const nodeUrl of nodeAddresses) {
        try {
            const response = await axios.get(`${nodeUrl}/fragments/${filename}`);
            fragmentPaths.push(response.data);
            for (const fragment of metadata.fragments) {
                const fragmentPathResponse = await axios.get(`${nodeUrl}/fragments/${fragment}`);
                fragmentPaths.push(fragmentPathResponse.data);
            }
        } catch (error) {
            console.error(`Error retrieving fragment from ${nodeUrl}:`, error);
        }
    }

    // Assuming fragments are stored locally; reassemble them
    const outputPath = path.join(__dirname, 'uploads', filename);
    const writeStream = fs.createWriteStream(outputPath);

    for (const path of fragmentPaths) {
        const data = fs.readFileSync(path);
        writeStream.write(data);
    }

    writeStream.end(() => {
        res.send('File reassembled successfully.');
    });
});

app.get('/fragments/:filename', (req, res) => {
    const filename = req.params.filename;

    // List all fragment paths (this should be replaced with your actual storage logic)
    const fragmentDirectory = path.join(__dirname, 'uploads', 'fragments');
    const fragments = fs.readdirSync(fragmentDirectory).filter(file => file.startsWith(filename));

    if (fragments.length === 0) {
        return res.status(404).send('No fragments found.');
    }

    // Return the full paths of the fragments
    const fragmentPaths = fragments.map(fragment => path.join(fragmentDirectory, fragment));
    res.json(fragmentPaths);
});


const contractAddress = "YOUR_CONTRACT_ADDRESS";
const abi = [ /* contract ABI goes here */ ];



// Endpoint to save account data
app.post('/saveAccount', async (req, res) => {
    const { walletAddress, storageBought, totalSpent } = req.body;
    try {
        const transaction = new Transaction({ walletAddress, storageBought, totalSpent });
        await transaction.save();
        res.json({ message: 'Account saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving account', error });
    }
});


app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});