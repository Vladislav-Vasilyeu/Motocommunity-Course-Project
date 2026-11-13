export type User = { id: string; email?: string; displayName: string; role?: string; profile?: { bio?: string; city?: string; ridingStyle?: string } }
export type Post = { id: string; content: string; createdAt: string; author: User; community?: { id: string; name: string } | null }
export type Listing = { id: string; title: string; description: string; category: string; price: string | number; condition: string; city: string; status: string; seller: User }
export type Community = { id: string; name: string; description: string; city: string; _count?: { members: number; posts: number } }
export type Motorcycle = { id: string; make: string; model: string; year?: number | null; mileage?: number | null }
export type Trip = { id: string; title: string; description: string; startsAt: string; organizer: User; waypoints: { id: string; latitude: number | string; longitude: number | string; label: string }[]; isJoined?: boolean; _count?: { participants: number } }
export type Place = { id: string; name: string; category: string; city: string; latitude: number | string; longitude: number | string; description?: string }
export type FriendRequest = { id: string; sender: User }
export type RouteWaypoint = { id: string; title: string; latitude: number | string; longitude: number | string; position: number }
export type CommunityRoute = { id: string; title: string; description: string; authorId: string; author: Pick<User, 'id' | 'displayName'>; createdAt: string; waypoints: RouteWaypoint[]; isFavorite: boolean }
export type DirectMessage = { id: string; senderId: string; recipientId: string; content: string; createdAt: string }
export type Dialog = { user: Pick<User, 'id' | 'displayName'>; lastMessage: DirectMessage }
export type MessageHistory = { messages: DirectMessage[]; nextCursor: string | null; user: Pick<User, 'id' | 'displayName'> }

export function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form))
}
