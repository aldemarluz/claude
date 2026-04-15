import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function QuickResponseSelector({ onSelect, disabled = false }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState({});

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const workspaceId = await getWorkspaceId();
      const filter = workspaceId ? { workspace_id: workspaceId } : {};
      const data = await base44.entities.QuickResponse.filter(filter, "ordem", 100);
      setResponses(data);

      // Group by category
      const groups = {};
      data.forEach((resp) => {
        const cat = resp.categoria || "outro";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(resp);
      });
      setGrouped(groups);
    } catch (err) {
      console.error("Erro ao carregar respostas rápidas:", err);
    } finally {
      setLoading(false);
    }
  };

  const categories = {
    saudação: "Saudações",
    despedida: "Despedidas",
    suporte: "Suporte",
    venda: "Vendas",
    outro: "Outro",
  };

  if (loading || responses.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="w-10 h-10 rounded-full"
          title="Respostas Rápidas"
        >
          <Zap className="w-5 h-5 text-amber-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase">
              {categories[category] || category}
            </DropdownMenuLabel>
            {items.map((resp) => (
              <DropdownMenuItem
                key={resp.id}
                onClick={() => onSelect(resp.mensagem)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="font-medium text-sm">{resp.titulo}</span>
                <span className="text-xs text-slate-500 line-clamp-1">
                  {resp.mensagem}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}