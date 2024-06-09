const express = require("express");
const mysql = require("mysql2");
require("dotenv").config();
const session = require("express-session");
const { engine } = require("express-handlebars");
const path = require("path");
const moment = require("moment");
const { promisify } = require("util");
const app = express();
const fs = require('fs').promises;
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {SpacesServiceClient} = require('@google-apps/meet').v2;
const { auth } = require('google-auth-library');
const dotenv = require('dotenv');
dotenv.config();

// Set up the database connection
const db = mysql.createConnection({
	host: '127.0.0.1',
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
  port: 3306,
});

db.connect((err) => {
if (err) {
throw err;
}
console.log('Connected to database');
});


// Static folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const query = promisify(db.query).bind(db);

const LOGIN_MESSAGES = {
FIELDS_EMPTY: "fieldsempty",
CREDENTIALS_INCORRECT: "credentialsincorrect",
PASSWORD_INCORRECT: "passwordincorrect",
};

const statsFunc = async () => {
  const count = {
    patient: 0,
    docteur: 0,
    consultation: 0,
    rendezvous: 0,
    ordonnace: 0,
};
db.query('SELECT COUNT(*) AS patient FROM patient', (err, results) => {
  if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
  }
  count.patient = results[0].patient;
});


db.query('SELECT COUNT(*) AS docteur FROM docteur', (err, results) => {
  if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
  }
  count.docteur = results[0].docteur;
});

db.query('SELECT COUNT(*) AS consultation FROM consultation', (err, results) => {
  if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
  }
  count.consultation = results[0].consultation;
});

db.query('SELECT COUNT(*) AS rendezvous FROM rendezvous', (err, results) => {
  if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
  }
  count.rendezvous = results[0].rendezvous;
});

db.query('SELECT COUNT(*) AS ordonnace FROM ordonnace', (err, results) => {
  if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
  }
  count.ordonnace = results[0].ordonnace;

  // Now you can use the count object with the updated counts
  console.log(count);
});

 return count;
}

// Middleware for handling errors
app.use((req, res, next) => {
try {
next();
} catch (err) {
console.error(err.stack);
res.status(500).send("Something broke!\n" + err);
}
});


app.use(
session({
secret: "secret",
resave: true,
saveUninitialized: true,
})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.engine(
".hbs",
engine({
extname: ".hbs",
helpers: {
ifEquals: function (arg1, arg2, options) {
return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
},
truncate: function (str, len) {
if (str.length > len && str.length > 0) {
let new_str = str + ' '
new_str = str.substr(0, len)
new_str = str.substr(0, new_str.lastIndexOf(' '))
new_str = new_str.length > 0 ? new_str : str.substr(0, len)
return new_str + '...'
}
return str
},
stripTags: function (input) {
return input.replace(/<(?:.|\n)*?>/gm, '')
},
formatDate: function (date, format) {
return moment(date).utc('CET').format(format)
},
selected: function (option, value) {
if (option === value) {
return ' selected';
} else {
return ''
}},},
})
);

app.set("view engine", ".hbs");
app.set("views", "./views");


// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return auth.fromJSON(credentials);
  } catch (err) {
    console.log(err);
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Creates a new meeting space.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function createSpace(authClient) {
  const meetClient = new SpacesServiceClient({
    authClient: authClient
  });
  // Construct request
  const request = {
  };

  // Run request
  const response = await meetClient.createSpace(request);
  console.log(`Meet URL: ${response[0].meetingUri}`);
}

authorize().then(createSpace).catch(console.error);









// Function for checking if email exists
async function emailExists(email) {
const results = await query("SELECT * FROM user WHERE email = ?", [email]);
return results.length > 0;
}





app.post("/login", async (req, res, next) => {
try {
const { email, password } = req.body;

if (!email || !password) {
return res.redirect(`/login?message=${LOGIN_MESSAGES.FIELDS_EMPTY}`);
}

const [user] = await query("SELECT * FROM patient WHERE mailP = ?", [email]);

if (!user) {
return res.redirect(`?message=${LOGIN_MESSAGES.CREDENTIALS_INCORRECT}`);
}

const userObject = {
nom: user.nomP,
prenom: user.prenomP,
adresse: user.adresse,
email: user.email,
password: user.password,
user_id: user.idP,
};

req.session.loggedin = true;
req.session.email = email;
req.session.user_id = userObject.user_id;
req.session.userObject = userObject;

res.redirect("/home");
	} catch (error) {
		next(error);
	}
});
app.post("/logind", async (req, res, next) => {
    try {
    const { email, password } = req.body;
    
    if (!email || !password) {
    return res.redirect(`/login?message=${LOGIN_MESSAGES.FIELDS_EMPTY}`);
    }
    
    const [user] = await query("SELECT * FROM docteur WHERE mailDoc = ?", [email]);
    
    if (!user) {
    return res.redirect(`/login?message=${LOGIN_MESSAGES.CREDENTIALS_INCORRECT}`);
    }
    const userObject = {
    nom: user.nom,
    prenom: user.prenom,
    adresse: user.adresse,
    email: user.email,
    password: user.password,
    user_id: user.idDoc,
    };

    req.session.loggedin = true;
    req.session.email = email;
    req.session.user_id = userObject.user_id;
    req.session.userObject = userObject;
    console.log(userObject);
    res.redirect("/homed");
        } catch (error) {
            next(error);
        }
    });
app.post("/loginad", async (req, res, next) => {
try {
const { email, password } = req.body;

const [user] = await query("SELECT * FROM administrateur WHERE mail = ?", [email]);

if (!user) {
	return res.redirect(`/login?message=${LOGIN_MESSAGES.CREDENTIALS_INCORRECT}`);
}

const userObject = {
nom: user.nom,
prenom: user.prenom,
email: user.email,
password: user.password,
user_id: user.idA,
};

req.session.loggedin = true;
req.session.email = email;
req.session.user_id = userObject.user_id;
req.session.userObject = userObject;

res.redirect("/dashbord");
} catch (error) {
next(error);
}
});

// POST /user route for adding a patient
app.post('/register', (req, res) => {
const { nom, prenom, adresse, email, password } = req.body;
const values = [
[
nom,
prenom,
adresse,
email,
password
],
];
console.log("values - ", values);
const sql = `INSERT INTO patient (nomP, prenomP,adresseP, mailP, mdpP) VALUES ?`;
db.query(sql, [values], (err, result) => {
	if (err) {
	return res.status(500).send(err);
	}
// Redirect to login page
res.redirect('/login');
});
});

// POST /user route for adding a docteur
app.post('/registerdoc', (req, res) => {
const { nom, prenom, adresse, Spécialité, Tel, Cin, Ni, email, password } = req.body;
const values = [[
nom,
prenom,
adresse,
Spécialité,
Tel,
Cin,
Ni,
email,
password
],
];
const sql = `INSERT INTO docteur (nomDoc, prenomDoc,adresseDoc,telDoc,cinDoc,specialite,numidentification, mailDoc, mdpDoc) VALUES ?`;
db.query(sql, [values], (err, result) => {
	if (err) {
	return res.status(500).send(err);
	}
// Redirect to login page
res.redirect('/logind');
});
});


app.get("/logout", (req, res, next) => {
	req.session.destroy();
	return res.redirect("/");
});
// Route  insert description into the database
app.post('/adddesc', (req, res) => {
const { nom, prenom, tel, specialite,prix, jobDescription,date_exp } = req.body;


// Prepare data for insertion
const values = [ nom, prenom, tel, specialite,prix,jobDescription,date_exp];

// Prepare SQL query with placeholders
const sql = "INSERT INTO description (nom, prenom, tel, specialite,prix, jobDescription,date_exp) VALUES (?, ?, ?, ?, ?, ?, ?)";
           
// Execute the query
db.query(sql, values, (err, result) => {
 if (err) {
        console.error('Error inserting job into database:', err);
        res.status(500).send('Error adding job');
        return;
    }
    
    res.redirect('/home'); // Redirect to dashboard after successfully adding the job
});           
});
// Route  insert ordonnance into the database
app.post('/ord', (req, res) => {
    const { nom, prenom, ordonnance } = req.body;

    
    // Prepare data for insertion
    const values = [ nom, prenom, ordonnance];
    
    // Prepare SQL query with placeholders
    const sql = "INSERT INTO ordonnace (nom, prenom, ordonnance) VALUES (?, ?, ?)";
               
    // Execute the query
    db.query(sql, values, (err, result) => {
     if (err) {
            console.error('Error inserting ordonnance into database:', err);
            res.status(500).send('Error adding ordonnance');
            return;
        }
        res.redirect('/dashbordord'); // Redirect to dashboard after successfully adding the job
    });           
    });
// Route  insert consultation into the database
app.post('/consultation', (req, res) => {
  const { nom, prenom, dateC } = req.body;

  
  // Prepare data for insertion
  const values = [ nom, prenom, dateC];
  
  // Prepare SQL query with placeholders
  const sql = "INSERT INTO consultation (nom, prenom, dateC) VALUES (?, ?, ?)";
             
  // Execute the query
  db.query(sql, values, (err, result) => {
   if (err) {
          console.error('Error inserting ordonnance into database:', err);
          res.status(500).send('Error adding consultation');
          return;
      }
      res.redirect('/dashbordcon'); // Redirect to dashboard after successfully adding the job
  });           
  });

// Route to handle updating a job
app.post('/updatedesc/:id', (req, res) => {
	// Get the job ID from the URL parameters
const descId = req.params.id;
const { nom, prenom, tel, specialite, jobDescription } = req.body;
	
           
// Prepare SQL query with placeholders
const sql = "UPDATE description SET nom = ?, prenom = ?, tel = ?, specialite = ?, jobDescription = ? WHERE id = ? ";
           
// Prepare data for insertion
const values = [ nom, prenom, tel, specialite,jobDescription,descId];           
// Update the job in the database
db.query(sql, values, (err, result) => {
    if (err) {
        console.error('Error updating description:', err);
        return res.status(500).send('Error updating description');
    }
           
    // Check if the job was successfully updated
    if (result.affectedRows === 0) {
        return res.status(404).send('Job not found');
    }
           
    // Job updated successfully
    res.redirect('/homed', { details: results[0] }); // Redirect to dashboard after successfully adding the job
});
});
// Route to handle updating a job
app.post('/mord', (req, res) => {
	// Get the job ID from the URL parameters
const { id, nom, prenom,ordonnance } = req.body;
	
const descId = id; 
console.log(descId);
console.log(nom);
console.log(prenom);
console.log(ordonnance);

           
// Prepare SQL query with placeholders
const sql = "UPDATE ordonnace SET nom = ?, prenom = ?, ordonnance = ? WHERE idO = ? ";
           
// Prepare data for insertion
const values = [ nom, prenom, ordonnance,descId];           
// Update the job in the database
db.query(sql, values, (err, result) => {
    if (err) {
        console.error('Error updating description:', err);
        return res.status(500).send('Error updating description');
    }
           
    // Check if the job was successfully updated
    if (result.affectedRows === 0) {
        return res.status(404).send('Job not found');
    }
           
    // Job updated successfully
    res.redirect('/dashbordord'); // Redirect to dashboard after successfully adding the job
});
});
// Route to handle updating a job
app.post('/mcon', (req, res) => {
	// Get the job ID from the URL parameters
const { id, nom, prenom,dateC } = req.body;
const descId = id;
// Prepare data for insertion
const values = [ nom, prenom, dateC,descId]; 
	

// Prepare SQL query with placeholders
const sql = "UPDATE consultation SET nom = ?, prenom = ?, dateC = ? WHERE idCo = ? ";
                     
// Update the job in the database
db.query(sql, values, (err, result) => {
    if (err) {
        console.error('Error updating description:', err);
        return res.status(500).send('Error updating description');
    }
           
    // Check if the job was successfully updated
    if (result.affectedRows === 0) {
        return res.status(404).send('Job not found');
    }
           
    // Job updated successfully
    res.redirect('/dashbordcon'); // Redirect to dashboard after successfully adding the job
});
});

app.get('/mrdv/:id', (req, res) => {
  // Render the editRdv.ejs file with the provided id
  //get the rendez-vous record with the provided id

  db.query('SELECT * FROM rendezvous WHERE idR = ?', [req.params.id], (err, results) => {
    if (err) {
      console.error('Error fetching rendez-vous details from database:', err);
      res.status(500).send('Error fetching rendez-vous details');
      return;
    }

    // Render the 'mrdv' template with the fetched data
    res.render('mrdv', { details: results[0] }); // Assuming there's only one result
  });

});

// POST endpoint to handle the form submission and update the rendez-vous record
app.post('/mrdv', (req, res) => {
  // Retrieve the data from the form submission (nomDoc, prenomDoc, dateR)
  const { idR, dateR } = req.body;
  //update it 
  db.query('UPDATE rendezvous SET dateR = ? WHERE idR = ?', [dateR, idR], (err, results) => {
    if (err) {
      console.error('Error updating rendez-vous:', err);
      res.status(500).send('Error updating rendez-vous');
      return;
    }

    // Redirect to the dashboard after successfully updating the rendez-vous record
    res.redirect('/dashbordrend');
  });

});
// Route to handle updating a patient
app.post('/settings/:id', (req, res) => {
// Get the job ID from the URL parameters
const descId = req.params.id;
const { nom, prenom,adresse,mail,password  } = req.body;
	
           
// Prepare SQL query with placeholders
const sql = "UPDATE patient SET nomP = ?, prenomP = ?, adresseP = ?, mailP = ?, mdpP = ? WHERE id = ? ";
           
// Prepare data for insertion
const values = [ nom, prenom, adresse,mail,password ,descId];           
// Update the job in the database
db.query(sql, values, (err, result) => {
    if (err) {
        console.error('Error updating patient:', err);
        return res.status(500).send('Error updating patient');
    }
           
    // Check if the job was successfully updated
    if (result.affectedRows === 0) {
        return res.status(404).send('patient not found');
    }
           
    // Job updated successfully
res.redirect('/'); // Redirect to dashboard after successfully adding the job
});
});
// Route to handle updating a docteur
app.post('/settings/:id', (req, res) => {
	// Get the job ID from the URL parameters
const descId = req.params.id;
const { nom, prenom,adresse,mail,password  } = req.body;
	
           
// Prepare SQL query with placeholders
const sql = "UPDATE docteur SET nomDoc = ?, prenomDoc = ?, adresseDoc = ?, mailDoc = ?, mdpDoc = ? WHERE id = ? ";
           
// Prepare data for insertion
const values = [ nom, prenom, adresse,mail,password ,descId];           
// Update the job in the database
db.query(sql, values, (err, result) => {
    if (err) {
        console.error('Error updating docteur:', err);
        return res.status(500).send('Error updating docteur');
    }
           
    // Check if the job was successfully updated
    if (result.affectedRows === 0) {
        return res.status(404).send('docteur not found');
    }
           
    // Job updated successfully
    res.redirect('/'); // Redirect to dashboard after successfully adding the job
});
});
// Route to handle deleting a job
app.get('/deletedesc/:id', (req, res) => {
// Get the job ID from the URL parameters
const jobId = req.params.id;
           
// Delete the job from the database
db.query('DELETE FROM description WHERE idD = ?', [jobId], (err, result) => {
    if (err) {
        console.error('Error deleting job:', err);
        return res.status(500).send('Error deleting job');
    }
           
    // Check if the job was successfully deleted
    if (result.affectedRows === 0) {
        return res.status(404).send('Job not found');
    }
           
    // Job deleted successfully
    res.redirect('/homed'); // Redirect to dashboard after successfully adding the job
});
});
// Route to handle deleting a consultation
app.get('/deletecon/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const jobId = req.params.id;
             
  // Delete the job from the database
  db.query('DELETE FROM consultation WHERE idCo = ?', [jobId], (err, result) => {
      if (err) {
          console.error('Error deleting consultation:', err);
          return res.status(500).send('Error deleting consultation');
      }
             
      // Check if the job was successfully deleted
      if (result.affectedRows === 0) {
          return res.status(404).send('consultation not found');
      }
             
      // Job deleted successfully
      res.redirect('/dashbordcon'); // Redirect to dashboard after successfully adding the job
  });
  });
// Route to display details of a specific job
app.get('/detailsdesc/:id', (req, res) => {
    // Get the job ID from the URL parameters
    const descId = req.params.id;
  
    // Fetch data for the job with the specified ID from the database
    db.query('SELECT * FROM description WHERE idD = ?', [descId], (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching job details');
        return;
      }

      // Render the 'details' template with the fetched data
      res.render('./detailsdesc', { details: results[0] }); // Assuming there's only one result
    });
  });
  // Route to display details of a specific job
app.get('/detaild/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const descId = req.params.id;

  // Fetch data for the job with the specified ID from the database
  db.query('SELECT * FROM description WHERE idD = ?', [descId], (err, results) => {
    if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
    }

    // Render the 'details' template with the fetched data
    res.render('./detaild', { details: results[0] }); // Assuming there's only one result
  });
});
  // Route to display details of a specific job
  app.get('/detailad/:id', (req, res) => {
    // Get the job ID from the URL parameters
    const descId = req.params.id;
  
    // Fetch data for the job with the specified ID from the database
    db.query('SELECT * FROM description WHERE idD = ?', [descId], (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching job details');
        return;
      }
  
      // Render the 'details' template with the fetched data
      res.render('./detailad', { details: results[0] }); // Assuming there's only one result
    });
  });
  // Route to handle deleting a ordonnance
app.get('/deleteord/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const jobId = req.params.id;          
  // Delete the job from the database
  db.query('DELETE FROM ordonnace WHERE idO = ?', [jobId], (err, result) => {
      if (err) {
          console.error('Error deleting ordonnance:', err);
          return res.status(500).send('Error deleting ordonnance');
      }
             
      // Check if the job was successfully deleted
      if (result.affectedRows === 0) {
          return res.status(404).send('ordonnance not found');
      }
             
      // Job deleted successfully
      res.redirect('/dashbordord'); // Redirect to dashboard after successfully adding the job
  });
  });
    // Route to handle deleting a patient
app.get('/deletep/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const jobId = req.params.id;          
  // Delete the job from the database
  db.query('DELETE FROM patient WHERE idP = ?', [jobId], (err, result) => {
      if (err) {
          console.error('Error deleting patient:', err);
          return res.status(500).send('Error deleting patient');
      }
             
      // Check if the job was successfully deleted
      if (result.affectedRows === 0) {
          return res.status(404).send('patient not found');
      }
             
      // Job deleted successfully
      res.redirect('/dashbordp'); // Redirect to dashboard after successfully adding the job
  });
  });
  app.get('/deletep/:id', (req, res) => {
    // Get the job ID from the URL parameters
    const jobId = req.params.id;          
    // Delete the job from the database
    db.query('DELETE FROM patient WHERE idP = ?', [jobId], (err, result) => {
        if (err) {
            console.error('Error deleting patient:', err);
            return res.status(500).send('Error deleting patient');
        }
               
        // Check if the job was successfully deleted
        if (result.affectedRows === 0) {
            return res.status(404).send('patient not found');
        }
               
        // Job deleted successfully
        res.redirect('/dashbordp'); // Redirect to dashboard after successfully adding the job
    });
    });
    app.get('/deleted/:id', (req, res) => {
      // Get the job ID from the URL parameters
      const jobId = req.params.id;          
      // Delete the job from the database
      db.query('DELETE FROM docteur WHERE idD = ?', [jobId], (err, result) => {
          if (err) {
              console.error('Error deleting patient:', err);
              return res.status(500).send('Error deleting patient');
          }
                 
          // Check if the job was successfully deleted
          if (result.affectedRows === 0) {
              return res.status(404).send('patient not found');
          }
                 
          // Job deleted successfully
          res.redirect('/dashbord'); // Redirect to dashboard after successfully adding the job
      });
      });
    // GET route to display the edit form
app.get('/editd/:id', (req, res) => {
  // Fetch the doctor details based on the id
  const doctor = { id: 1, name: 'Dr. John Doe', speciality: 'General Physician', address: '123, XYZ Street, ABC City', phone: '1234567890' };
  res.render('editDoctor', { doctor });
});

// POST route to update the doctor details
app.post('/editd/:id', (req, res) => {
  // Update the doctor details in the database
  // Redirect to the main doctor list page after updating
  res.redirect('/dashbord');
});

app.get('/editPat/:id', (req, res) => {
  // Fetch patient data based on the provided ID (req.params.id)
  // Render the edit form with the fetched data
  const patient =  { id: 1, name: 'Dr. John Doe', speciality: 'General Physician', address: '123, XYZ Street, ABC City', phone: '1234567890' };
  res.render('editPat', { patient });
});

// POST endpoint to handle the form submission
app.post('/editPat/:id', (req, res) => {
  const { id } = req.params;
  const { nom, prenom, dateC } = req.body;

  // Update patient data in the database based on the provided ID and form data
  // Redirect to a confirmation page or the updated patient details page
  res.redirect(`/dashbordp`);
});
  app.post('/rendez', (req, res) => {
    const { dateR } = req.body;

    
    // Prepare data for insertion
    const values = [ dateR];
    
    // Prepare SQL query with placeholders
    const sql = "INSERT INTO rendezvous (dateR) VALUES (?)";
               
    // Execute the query
    db.query(sql, values, (err, result) => {
     if (err) {
            console.error('Error inserting rendez-vous into database:', err);
            res.status(500).send('Error adding rendez-vous');
            return;
        }
        res.redirect('/home'); // Redirect to dashboard after successfully adding the job
    });           
    });
// Define routes
app.get('/', (req, res) => {
	res.render('index');
});
app.get('/adddesc', (req, res) => {
	res.render('adddesc');
});
app.get('/consultation', (req, res) => {
	res.render('consultation');
});

app.get('/updatedesc/:id', (req, res) => {
	res.render('updatedesc');
});

app.get('/registerdoc', (req, res) => {
	res.render('registerdoc');
});

app.get('/register', (req, res) => {
	res.render('register');
});

app.get('/loginad', (req, res) => {
	res.render('loginad');
});

app.get('/login', (req, res) => {
	res.render('login');
});
app.get('/logind', (req, res) => {
	res.render('logind');
});
app.get('/dashbord', async (req, res) => {

    // count for those tables patient , docteur , consultation , rendezvous , ordonnac
    const count = await statsFunc();
    db.query('SELECT * FROM docteur  ',  (err, results) => {
        if (err) {
          console.error('Error fetching job details from database:', err);
          res.status(500).send('Error fetching job details');
          return;
        }
        
        
        // Render the 'details' template with the fetched data
        res.render('./dashbord', { details: results, stats: count }); // Assuming there's only one result
      });
});
app.get('/dashbordp', async (req, res) => {

  const stats = await statsFunc();

  db.query('SELECT * FROM patient  ',  (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching job details');
        return;
      }
      
      
      // Render the 'details' template with the fetched data
      res.render('./dashbordp', { details: results, stats: stats }); // Assuming there's only one result
    });
});

app.get('/dashbordcon', async (req, res) => {

  const stats = await statsFunc();

  db.query('SELECT * FROM consultation  ',  (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching job details');
        return;
      }
      
      // Render the 'details' template with the fetched data
      res.render('./dashbordcon', { details: results, stats: stats }); // Assuming there's only one result
    });
});
app.get('/dashbordrend', async (req, res) => {

  const stats = await statsFunc();

  db.query('SELECT * FROM rendezvous ',  (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching job details');
        return;
      }
      
      
      // Render the 'details' template with the fetched data
      res.render('./dashbordrend', { details: results, stats: stats }); // Assuming there's only one result
    });
});
app.get('/dashbordord', async (req, res) => {

  const stats = await statsFunc();
  db.query('SELECT * FROM ordonnace  ',  (err, results) => {
      if (err) {
        console.error('Error fetching job details from database:', err);
        res.status(500).send('Error fetching ordonnace details');
        return;
      }
      
      
      // Render the 'details' template with the fetched data
      res.render('./dashbordord', { details: results, stats: stats }); // Assuming there's only one result
    });
});
app.get('/settings', (req, res) => {
	res.render('settings');
});
app.get('/ord', (req, res) => {
	res.render('ord');
});
app.get('/home', (req, res) => {
	db.query('SELECT * FROM description  ',  (err, results) => {
        if (err) {
          console.error('Error fetching job details from database:', err);
          res.status(500).send('Error fetching job details');
          return;
        }
        
        // Render the 'details' template with the fetched data
        res.render('./home', { details: results,user_id:req.session.user_id }); // Assuming there's only one result

      });
});
app.get('/homed', (req, res) => {
	db.query('SELECT * FROM description  ',  (err, results) => {
        if (err) {
          console.error('Error fetching job details from database:', err);
          res.status(500).send('Error fetching job details');
          return;
        }
        
        // Render the 'details' template with the fetched data
        res.render('./homed', { details: results,user_id:req.session.user_id}); // Assuming there's only one result
 });
});
app.get('/homead', (req, res) => {
	db.query('SELECT * FROM description  ',  (err, results) => {
        if (err) {
          console.error('Error fetching job details from database:', err);
          res.status(500).send('Error fetching job details');
          return;
        }
        
        // Render the 'details' template with the fetched data
        res.render('./homead', { details: results }); // Assuming there's only one result

      });
}); 

app.get('/profile/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const descId = req.params.id;

  // Fetch data for the job with the specified ID from the database
  db.query('SELECT * FROM patient WHERE idP = ?', [descId], (err, results) => {
    if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
    }

    // Render the 'details' template with the fetched data
    res.render('./profile', { details: results[0] }); // Assuming there's only one result
  });
});
app.get('/profiled/:id', (req, res) => {
  // Get the job ID from the URL parameters
  const descId = req.params.id;

  // Fetch data for the job with the specified ID from the database
  db.query('SELECT * FROM docteur WHERE idDoc = ?', [descId], (err, results) => {
    if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching profile details');
      return;
    }
    // Render the 'details' template with the fetched data
    res.render('./profiled', { details: results[0] }); // Assuming there's only one result
  });
});

app.get('/detailsdesc', (req, res) => {
	res.render('detailsdesc');
});
app.get('/rendez', (req, res) => {
	res.render('rendez');
});

app.get('/payement', (req, res) => {
	res.render('payement');
});
app.get('/forget', (req, res) => {
	res.render('forget');
});
app.get('/mord/:id', (req, res) => {

  //select ordonnance by id

  db.query('SELECT * FROM ordonnace WHERE idO = ?', [req.params.id], (err, results) => {
    if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
    }

    console.log(results[0])

    // Render the 'details' template with the fetched data
    res.render('./mord', { details: results[0] }); // Assuming there's only one result
  });

	// res.render('mord');
});
app.get('/mcon/:id', (req, res) => {
  //get the consultation by id
  db.query('SELECT * FROM consultation WHERE idCo = ?', [req.params.id], (err, results) => {
    if (err) {
      console.error('Error fetching job details from database:', err);
      res.status(500).send('Error fetching job details');
      return;
    }

    console.log(results[0])

    // Render the 'details' template with the fetched data
    res.render('./mcon', { details: results[0] }); // Assuming there's only one result
  });
	// res.render('mcon');
});
app.get('/settingsp', (req, res) => {
	res.render('settingsp');
});
app.get('/pagehome', (req, res) => {
	res.render('pagehome');
});
app.listen(PORT, () => {
	console.log(`Server started on ${new Date().toLocaleString()} at port ${PORT}`);
});