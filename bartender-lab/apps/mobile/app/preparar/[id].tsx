import { formatQuantity } from '@bartender-lab/client-core';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Loading } from '../../src/components/ui';
import { useRecipe, useTechnique } from '../../src/hooks';
import { colors, radius, spacing } from '../../src/theme';

function Timer({ seconds, label }: { seconds: number; label: string }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLeft(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    interval.current = setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          Vibration.vibrate([0, 400, 200, 400]);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [running]);

  return (
    <View style={styles.timer}>
      <Text style={styles.timerLabel}>{label}</Text>
      <Text style={styles.timerValue}>{`${left} s`}</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={running ? 'Pausar' : left === 0 ? 'Listo' : 'Iniciar'}
            icon={running ? 'pause' : 'timer-outline'}
            onPress={() => (left === 0 ? setLeft(seconds) : setRunning(!running))}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Reiniciar"
            icon="refresh"
            variant="secondary"
            onPress={() => {
              setRunning(false);
              setLeft(seconds);
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default function PrepareScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { id, porciones } = useLocalSearchParams<{ id: string; porciones?: string }>();
  const servings = porciones ? Number(porciones) : undefined;
  const recipe = useRecipe(id, servings);
  const technique = useTechnique(recipe.data?.technique?.id ?? '');
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (!recipe.data) return <Loading />;
  const r = recipe.data;
  const total = r.steps.length + 2; // ingredients + steps + done
  const step = index >= 1 && index <= r.steps.length ? r.steps[index - 1] : null;
  const timerSeconds = step?.durationSeconds ?? technique.data?.durationSeconds ?? null;

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.recipe} numberOfLines={1}>
          {r.name}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {index === 0 ? (
          <>
            <Text
              style={styles.kicker}
            >{`Prepara los ingredientes · ${r.servings === 1 ? '1 porción' : `${r.servings} porciones`}`}</Text>
            {r.ingredients.map((line) => {
              const done = checked.has(line.id);
              return (
                <Pressable
                  key={line.id}
                  style={styles.check}
                  onPress={() => {
                    const next = new Set(checked);
                    if (done) next.delete(line.id);
                    else next.add(line.id);
                    setChecked(next);
                  }}
                >
                  <Ionicons
                    name={done ? 'checkbox' : 'square-outline'}
                    size={28}
                    color={done ? colors.lime : colors.muted}
                  />
                  <Text style={[styles.checkText, done && styles.checkDone]}>
                    {`${formatQuantity(line.quantity, line.unit)} ${line.name}${line.optional ? ' (opcional)' : ''}`}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.hint}>{`Vaso: ${r.glassware?.name ?? '—'}`}</Text>
          </>
        ) : step ? (
          <>
            <Text style={styles.kicker}>{`Paso ${step.stepNumber} de ${r.steps.length}`}</Text>
            <Text style={styles.instruction}>{step.instruction}</Text>
            {timerSeconds ? (
              <Timer
                seconds={timerSeconds}
                label={
                  step.durationSeconds
                    ? 'Tiempo del paso'
                    : `Temporizador de ${r.technique?.name ?? 'la técnica'}`
                }
              />
            ) : null}
          </>
        ) : (
          <View style={styles.done}>
            <Ionicons name="wine" size={72} color={colors.primary} />
            <Text style={styles.instruction}>¡Salud!</Text>
            {r.garnish ? <Text style={styles.hint}>{`Decoración: ${r.garnish}`}</Text> : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Anterior"
            icon="arrow-back"
            variant="secondary"
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
          />
        </View>
        <View style={styles.flex}>
          {index < total - 1 ? (
            <Button label="Siguiente" icon="arrow-forward" onPress={() => setIndex(index + 1)} />
          ) : (
            <Button label="Terminar" icon="checkmark" onPress={() => router.back()} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recipe: { color: colors.primary, fontSize: 18, fontWeight: '800', flex: 1 },
  progress: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.primary },
  body: { gap: spacing.lg, paddingVertical: spacing.lg },
  kicker: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  instruction: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 40 },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkText: { color: colors.text, fontSize: 20, flex: 1 },
  checkDone: { color: colors.muted, textDecorationLine: 'line-through' },
  hint: { color: colors.muted, fontSize: 17 },
  timer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerLabel: { color: colors.muted, fontSize: 15 },
  timerValue: { color: colors.primary, fontSize: 56, fontWeight: '900', textAlign: 'center' },
  done: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
