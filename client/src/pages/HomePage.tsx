import { Link } from 'react-router-dom'

export function HomePage() {
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Hero Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 py-16 text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        Stellar Calendar
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Federated event management for the fediverse
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link
                            to="/login"
                            className="btn btn-primary text-lg px-8 py-3"
                        >
                            Get Started
                        </Link>
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary text-lg px-8 py-3"
                        >
                            Learn More
                        </a>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="max-w-6xl mx-auto px-4 py-16">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="card p-6">
                        <div className="text-4xl mb-4">🌐</div>
                        <h3 className="text-xl font-semibold mb-2">Federated</h3>
                        <p className="text-gray-600">
                            Connect with users across the fediverse using ActivityPub protocol
                        </p>
                    </div>

                    <div className="card p-6">
                        <div className="text-4xl mb-4">⚡</div>
                        <h3 className="text-xl font-semibold mb-2">Real-time</h3>
                        <p className="text-gray-600">
                            Live updates with Server-Sent Events for instant synchronization
                        </p>
                    </div>

                    <div className="card p-6">
                        <div className="text-4xl mb-4">📅</div>
                        <h3 className="text-xl font-semibold mb-2">Events</h3>
                        <p className="text-gray-600">
                            Create, share, and discover events with RSVP and social features
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage
