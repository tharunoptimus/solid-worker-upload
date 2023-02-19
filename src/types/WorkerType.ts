export interface WorkerMessage {
    type: "ready" | "progress" | "status" | "heartBeat" | "resumeUpload"
    fileName?: string
    progress?: number
    status?: string
    retry?: boolean
}