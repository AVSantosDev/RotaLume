import { FaUser, FaEye, FaEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { useNavigate } from "react-router-dom"; // 1. Importar o hook

const Login = () => {
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const navigate = useNavigate(); // 2. Inicializar o navegador

    // 3. Criar a função que lida com o login
    const handleLogin = (e) => {
        e.preventDefault(); // Impede a página de recarregar
        
        // Aqui você validaria o usuário/senha no backend futuramente.
        // Por enquanto, vamos direto para o dashboard:
        navigate("/dashboard");
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
            <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
                Login
            </h1>

            {/* 4. Adicionar o onSubmit no formulário */}
            <form className="space-y-4" onSubmit={handleLogin}>
                {/* Usuario */}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Usuário" 
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <FaUser className="absolute right-3 top-3 text-gray-400" />
                </div>

                {/* Senha */}
                <div className="relative">
                    <input 
                        type={mostrarSenha ? "text" : "password"} 
                        placeholder="Senha" 
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Ícone dinâmico */}
                    <span
                        onClick={() => setMostrarSenha(!mostrarSenha)} 
                        className="absolute right-3 top-3 text-gray-400 cursor-pointer"
                    >
                        {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
                    </span>
                </div>

                {/* Botão */}
                <button
                    type="submit" 
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                    Acessar
                </button>
            </form>
        </div>
    );
};

export default Login;