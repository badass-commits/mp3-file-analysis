## MP3 File Analysis API

### Prerequisites
- **Node.js**: v18+
- **npm**: installed with Node

### Install dependencies
```bash
npm install
```

### Build the app
```bash
npm run build
```

### Run the app
```bash
npm start
```

The server will start on `http://localhost:3000`.

### Test the `/file-upload` endpoint
- **URL**: `http://localhost:3000/file-upload`
- **Method**: `POST`
- **Body**: `multipart/form-data` with a field named `file` containing your `.mp3`.

Example with `curl`:
```bash
curl -X POST http://localhost:3000/file-upload ^
  -F "file=@path\to\your\file.mp3"
```

The response will look like:
```json
{
  "frameCount": 1234
}
```


