# Missiv

Missiv is a secure, self-hostable messaging application that evolved from the zcomm-cli concept. It provides end-to-end encrypted messaging with an intuitive email-like interface.

## Features

- **End-to-End Encryption**: Uses Curve25519 for secure communication
- **Immutable Messaging**: Messages (called "mivs") are immutable once sent
- **Phone-Number-Style IDs**: Simple, memorable identifiers for users
- **State Management**: Mivs are organized by state (IN/PENDING/OUT/ARCHIVED)
- **Self-Hosting**: Run your own instance for complete control
- **Offline Support**: Designed to work offline with sync capabilities
- **Clean Interface**: Email-like UX for intuitive message management

## Architecture

Missiv consists of two main components:

### Backend (Go + Gin)
- RESTful API server
- Encryption/decryption handling
- Miv storage and state management
- User identity management

### Frontend (React + TypeScript)
- Intuitive email-like interface
- Inbox view with miv states
- Compose and send mivs
- Real-time state updates

## Getting Started

### Prerequisites

- Go 1.21 or higher
- Node.js 18 or higher
- npm or yarn

### Development Setup

#### Backend

```bash
cd backend
go mod download
go run main.go
```

The backend server will start on `http://localhost:8080`.

#### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend will start on `http://localhost:3000`.

### Production Build

#### Backend

```bash
cd backend
go build -o missiv
./missiv
```

#### Frontend

```bash
cd frontend
npm run build
```

The production build will be available in `frontend/build/`.

## API Endpoints

### Mivs
- `GET /api/mivs` - List all mivs
- `GET /api/mivs/:id` - Get a specific miv
- `POST /api/mivs` - Create a new miv
- `PUT /api/mivs/:id/state` - Update miv state
- `GET /api/mivs/inbox` - Get inbox mivs (state: IN)
- `GET /api/mivs/pending` - Get pending mivs (state: PENDING)
- `GET /api/mivs/sent` - Get sent mivs (state: OUT)
- `GET /api/mivs/archived` - Get archived mivs (state: ARCHIVED)

### Identity
- `GET /api/identity` - Get current user identity
- `POST /api/identity` - Create a new identity
- `GET /api/identity/publickey` - Get public key

## Miv States

- **IN**: Received mivs in your inbox
- **PENDING**: Mivs being sent (queued or in-progress)
- **OUT**: Successfully sent mivs
- **ARCHIVED**: Archived mivs (inbox or sent)

## Security

Missiv uses **Curve25519** for key exchange and encryption. All mivs are encrypted end-to-end, ensuring that only the intended recipient can read them.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
