export interface Instance {
    id: string
    domain: string
    baseUrl: string
    software?: string
    version?: string
    title?: string
    description?: string
    iconUrl?: string
    contact?: string
    userCount?: number
    eventCount?: number
    lastActivityAt?: string
    isBlocked: boolean
    lastFetchedAt?: string
    lastErrorAt?: string
    lastError?: string
    createdAt: string
    updatedAt: string
}

export interface InstanceWithStats extends Instance {
    stats: {
        remoteUsers: number
        remoteEvents: number
        localFollowing: number
        localFollowers?: number
    }
}

export interface InstanceListResponse {
    instances: InstanceWithStats[]
    total: number
    limit: number
    offset: number
}

export interface InstanceSearchResponse {
    instances: Instance[]
}
