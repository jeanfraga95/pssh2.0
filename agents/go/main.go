package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const (
	AuthPassword = "3aLhq41VVMxRiLBqjxEOCQ"
	Port         = ":6969"
)

type Request struct {
	Comando string `json:"comando"`
}

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data,omitempty"`
}

func main() {
	http.HandleFunc("/", handleRequest)
	
	fmt.Printf("🚀 Agente PainelSSH iniciado na porta %s\n", Port)
	fmt.Printf("🔐 Senha de autenticação: %s\n", AuthPassword)
	
	log.Fatal(http.ListenAndServe(Port, nil))
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	// Verificar autenticação
	authHeader := r.Header.Get("Senha")
	if authHeader != AuthPassword {
		http.Error(w, "Não autorizado!", http.StatusUnauthorized)
		return
	}

	// Verificar método
	if r.Method != http.MethodPost {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}

	// Decodificar JSON
	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Erro ao decodificar JSON", http.StatusBadRequest)
		return
	}

	// Executar comando
	result, err := executeCommand(req.Comando)
	if err != nil {
		response := Response{
			Success: false,
			Message: err.Error(),
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	// Resposta de sucesso
	response := Response{
		Success: true,
		Message: "Comando executado com sucesso",
		Data:    result,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func executeCommand(command string) (string, error) {
	// Log do comando
	fmt.Printf("📝 Executando comando: %s\n", command)

	// Executar comando
	cmd := exec.Command("bash", "-c", command)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		return string(output), fmt.Errorf("erro ao executar comando: %v", err)
	}

	return string(output), nil
}
