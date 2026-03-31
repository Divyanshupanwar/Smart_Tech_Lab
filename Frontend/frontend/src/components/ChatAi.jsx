import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import axiosClient from "../utils/axiosClient";
import { Send, Bot, User } from 'lucide-react';

function ChatAi({ problem }) {
    const [messages, setMessages] = useState([
        { role: 'model', parts: [{ text: "👋 Hi! I'm your AI coding assistant. Ask me anything about this problem — I can give hints, review your code, or explain approaches." }] }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm();
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const onSubmit = async (data) => {
        const userMessage = { role: 'user', parts: [{ text: data.message }] };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        reset();
        setIsLoading(true);

        try {
            const response = await axiosClient.post("/ai/chat", {
                messages: updatedMessages,
                title: problem.title,
                description: problem.description,
                testCases: problem.visibleTestCases,
                startCode: problem.startCode
            });

            setMessages(prev => [...prev, {
                role: 'model',
                parts: [{ text: response.data.message }]
            }]);
        } catch (error) {
            console.error("API Error:", error);
            setMessages(prev => [...prev, {
                role: 'model',
                parts: [{ text: "⚠️ Sorry, I couldn't process your request. Please try again." }]
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        {msg.role !== "user" && (
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot className="w-4 h-4 text-indigo-600" />
                            </div>
                        )}
                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === "user"
                                ? "bg-indigo-600 text-white rounded-br-md"
                                : "bg-slate-100 text-slate-800 rounded-bl-md"
                        }`}>
                            {msg.parts[0].text}
                        </div>
                        {msg.role === "user" && (
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                                <User className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="border-t border-slate-200 p-4 bg-white"
            >
                <div className="flex items-center gap-3">
                    <input
                        placeholder="Ask about hints, solutions, or debugging..."
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50"
                        {...register("message", { required: true, minLength: 2 })}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        disabled={errors.message || isLoading}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ChatAi;