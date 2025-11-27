import { Link } from 'react-router-dom'

export function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Hero Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 py-16 text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        Stellar Calendar
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Open source, federated event management for the fediverse
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
                            View on GitHub
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 py-16 space-y-12">
                {/* Open Source */}
                <section>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Open Source</h2>
                    <p className="text-lg text-gray-700 leading-relaxed">
                        Stellar Calendar is built with open source principles at its core. 
                        We believe that event management should be decentralized, transparent, 
                        and accessible to everyone. The codebase is freely available, allowing 
                        communities to run their own instances and contribute to the project.
                    </p>
                </section>

                {/* Federation */}
                <section>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">The Power of Federation</h2>
                    <p className="text-lg text-gray-700 leading-relaxed mb-4">
                        Federation enables a truly interconnected network of independent servers. 
                        Unlike centralized platforms, federated systems give you:
                    </p>
                    <ul className="space-y-3 text-lg text-gray-700">
                        <li className="flex items-start gap-3">
                            <span className="text-2xl">🌐</span>
                            <span><strong>Freedom:</strong> Choose your own server or run your own instance</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-2xl">🔗</span>
                            <span><strong>Interoperability:</strong> Connect with users across different servers using ActivityPub</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-2xl">🛡️</span>
                            <span><strong>Resilience:</strong> No single point of failure - the network survives even if one server goes down</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-2xl">👥</span>
                            <span><strong>Community:</strong> Each server is owned and operated by its community</span>
                        </li>
                    </ul>
                </section>

                {/* Features */}
                <section>
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Features</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="card p-6">
                            <div className="text-4xl mb-4">⚡</div>
                            <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
                            <p className="text-gray-600">
                                Live synchronization with Server-Sent Events for instant updates across the network
                            </p>
                        </div>

                        <div className="card p-6">
                            <div className="text-4xl mb-4">📅</div>
                            <h3 className="text-xl font-semibold mb-2">Event Management</h3>
                            <p className="text-gray-600">
                                Create, share, and discover events with RSVP, comments, and social features
                            </p>
                        </div>

                        <div className="card p-6">
                            <div className="text-4xl mb-4">🌍</div>
                            <h3 className="text-xl font-semibold mb-2">ActivityPub</h3>
                            <p className="text-gray-600">
                                Built on the ActivityPub protocol, connecting with the wider fediverse
                            </p>
                        </div>

                        <div className="card p-6">
                            <div className="text-4xl mb-4">🔒</div>
                            <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                            <p className="text-gray-600">
                                Your data stays on your server. No tracking, no ads, no surveillance
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center py-8">
                    <Link
                        to="/"
                        className="btn btn-primary text-lg px-8 py-3"
                    >
                        View Public Events
                    </Link>
                </section>
            </div>
        </div>
    )
}

export default AboutPage

