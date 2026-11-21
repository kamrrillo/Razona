
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attempts": {
                  Row: {
                    "created_at": string,"id": string,"is_correct": boolean,"item_id": string,"selected_option": string,"session_id": string | null,"specialty_id": string,"topic": string,"used_tutor": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_correct": boolean,"item_id": string,"selected_option": string,"session_id"?: string | null,"specialty_id": string,"topic": string,"used_tutor"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean,"item_id"?: string,"selected_option"?: string,"session_id"?: string | null,"specialty_id"?: string,"topic"?: string,"used_tutor"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "casos_clinicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_app"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_rubrica"
      referencedColumns: ["caso_id"]
    },{
      foreignKeyName: "attempts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "study_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_specialty_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    }
                  ]
                },"casos_clinicos": {
                  Row: {
                    "caso_indice_id": string | null,"estado": string | null,"gpc_clave": string | null,"id": string,"payload": NonNullable<Json>,"respuesta_correcta": string | null,"sindrome": string | null,"tipo": string | null,"updated_at": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caso_indice_id"?: never,"estado"?: never,"gpc_clave"?: never,"id": string,"payload": NonNullable<Json>,"respuesta_correcta"?: never,"sindrome"?: never,"tipo"?: never,"updated_at"?: string,"version"?: never
                  }
                  Update: {
                    "caso_indice_id"?: never,"estado"?: never,"gpc_clave"?: never,"id"?: string,"payload"?: NonNullable<Json>,"respuesta_correcta"?: never,"sindrome"?: never,"tipo"?: never,"updated_at"?: string,"version"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "casos_clinicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "v_casos_app"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "v_casos_rubrica"
      referencedColumns: ["caso_id"]
    },{
      foreignKeyName: "casos_clinicos_sindrome_fkey"
      columns: ["sindrome"]
isOneToOne: false
      referencedRelation: "temas"
      referencedColumns: ["sindrome"]
    }
                  ]
                },"exam_answers": {
                  Row: {
                    "answered_at": string,"exam_id": string,"id": string,"is_correct": boolean,"item_id": string,"selected_option": string,"specialty_id": string,"topic": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"exam_id": string,"id"?: string,"is_correct": boolean,"item_id": string,"selected_option": string,"specialty_id": string,"topic": string,"user_id"?: string
                  }
                  Update: {
                    "answered_at"?: string,"exam_id"?: string,"id"?: string,"is_correct"?: boolean,"item_id"?: string,"selected_option"?: string,"specialty_id"?: string,"topic"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_answers_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "casos_clinicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_app"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_rubrica"
      referencedColumns: ["caso_id"]
    },{
      foreignKeyName: "exam_answers_specialty_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    }
                  ]
                },"exams": {
                  Row: {
                    "correct": number | null,"duration_seconds": number,"exam_key": string,"finished_at": string | null,"id": string,"item_ids": (string)[] | null,"scope": string,"scope_ref": string | null,"score": number | null,"started_at": string,"total": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct"?: number | null,"duration_seconds": number,"exam_key": string,"finished_at"?: string | null,"id"?: string,"item_ids"?: (string)[] | null,"scope"?: string,"scope_ref"?: string | null,"score"?: number | null,"started_at"?: string,"total"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "correct"?: number | null,"duration_seconds"?: number,"exam_key"?: string,"finished_at"?: string | null,"id"?: string,"item_ids"?: (string)[] | null,"scope"?: string,"scope_ref"?: string | null,"score"?: number | null,"started_at"?: string,"total"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"items": {
                  Row: {
                    "id": string,"is_sample": boolean,"kind": string,"payload": NonNullable<Json>,"specialty_id": string,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"is_sample"?: boolean,"kind": string,"payload": NonNullable<Json>,"specialty_id": string,"topic": string,"updated_at"?: string
                  }
                  Update: {
                    "id"?: string,"is_sample"?: boolean,"kind"?: string,"payload"?: NonNullable<Json>,"specialty_id"?: string,"topic"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_specialty_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"specialties": {
                  Row: {
                    "id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"study_sessions": {
                  Row: {
                    "completed_at": string | null,"id": string,"item_id": string,"messages": NonNullable<Json>,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"id"?: string,"item_id": string,"messages"?: NonNullable<Json>,"started_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"id"?: string,"item_id"?: string,"messages"?: NonNullable<Json>,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_sessions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "casos_clinicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_sessions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_app"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_sessions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_casos_rubrica"
      referencedColumns: ["caso_id"]
    }
                  ]
                },"temas": {
                  Row: {
                    "grupo_id": string,"nombre": string,"sindrome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "grupo_id": string,"nombre": string,"sindrome": string
                  }
                  Update: {
                    "grupo_id"?: string,"nombre"?: string,"sindrome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "temas_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "temas_grupos"
      referencedColumns: ["id"]
    }
                  ]
                },"temas_grupos": {
                  Row: {
                    "especialidad_id": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "especialidad_id": string,"id": string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "especialidad_id"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "temas_grupos_especialidad_id_fkey"
      columns: ["especialidad_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_casos_app": {
                  Row: {
                    "caso_indice_id": string | null,"estado": string | null,"grupo_id": string,"id": string,"payload": Json | null,"sindrome": string | null,"specialty_id": string,"tipo": string | null,"topic": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "casos_clinicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "v_casos_app"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_clinicos_caso_indice_id_fkey"
      columns: ["caso_indice_id"]
isOneToOne: false
      referencedRelation: "v_casos_rubrica"
      referencedColumns: ["caso_id"]
    },{
      foreignKeyName: "casos_clinicos_sindrome_fkey"
      columns: ["sindrome"]
isOneToOne: false
      referencedRelation: "temas"
      referencedColumns: ["sindrome"]
    },{
      foreignKeyName: "temas_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "temas_grupos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "temas_grupos_especialidad_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    }
                  ]
                },"v_casos_citas": {
                  Row: {
                    "caso_id": string | null,"fragmento": string | null,"gpc_clave": string | null,"guia": string | null,"orden": number | null,"origen": string | null,"pagina": number | null,"seccion": string | null,"texto": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_casos_rubrica": {
                  Row: {
                    "caso_id": string,"descripcion": string | null,"explicacion": string | null,"fragmento": string | null,"gpc_clave": string | null,"opciones_asociadas": (string)[] | null,"orden": number | null,"pagina": number | null,"pregunta_socratica_semilla": string | null,"seccion": string | null,"senales_en_justificacion": (string)[] | null,"tipo_error": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "cita_app":
{ Args: { "cita": Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
