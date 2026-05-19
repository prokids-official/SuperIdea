export type User = {
  id?: string
  email: string
  name: string
  avatar: string
  role?: 'admin' | 'member'
}

export type IdeaStatus = 'open' | 'claimed' | 'producing' | 'published'

export type Idea = {
  id: string
  title: string
  author: string
  avatar: string
  desc: string
  status: IdeaStatus
  statusLabel: string
  likes: number
  comments: number
  saves: number
  tags: string[]
  hot?: boolean
  market?: {
    count: number
    top: string
    chance: string
  }
}

export type IdeaDraft = {
  title: string
  desc: string
}
