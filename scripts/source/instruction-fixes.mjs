// The upstream dataset has no instructions for these entries; these are original texts.
export const FIXES = {
  // Upstream text skips the lift itself; replaced so English and Japanese agree.
  Leverage_Deadlift: {
    replace: true,
    en: ["Load the pins to an appropriate weight. Position yourself directly between the handles. Grasp the bottom handles with a comfortable grip, and then lower your hips as you take a breath. Look forward with your head and keep your chest up. This will be your starting position.", "Keeping your back straight, drive through your heels and extend your hips and knees until you are standing upright.", "Return the weight to the starting position."],
  },
  Iron_Cross: {
    en: ["Stand holding a light dumbbell in each hand at your sides.", "Raise both arms out to the sides, keeping a slight bend in the elbows, until they are level with your shoulders.", "Pause, then lower slowly back to your sides."],
    ja: ["軽いダンベルを両手に持ち、体の横に下げて立ちます。", "肘を軽く曲げたまま、両腕を肩の高さまで横に持ち上げます。", "一瞬止めてから、ゆっくり体の横に戻します。"],
  },
  "One-Arm_Kettlebell_Swings": {
    en: ["Stand with feet shoulder-width apart and the kettlebell on the floor in front of you.", "Hinge at the hips, grip the bell with one hand and hike it back between your legs.", "Snap your hips forward to swing the bell to chest height with a straight arm.", "Let it fall back and hinge into the next rep. Switch hands after the set."],
    ja: ["足を肩幅に開き、体の前の床にケトルベルを置きます。", "股関節を引いて片手でベルを握り、脚の間に振り込みます。", "腰を前に鋭く押し出し、腕を伸ばしたままベルを胸の高さまで振り上げます。", "ベルが戻るのに合わせて次の回へ股関節を引きます。セットごとに手を替えます。"],
  },
  Push_Press: {
    en: ["Hold a barbell at your shoulders in the front rack position with feet shoulder-width apart.", "Dip a few centimeters by bending your knees, keeping your torso upright.", "Drive explosively through your legs and press the bar overhead until your arms are locked out.", "Lower the bar back to your shoulders and reset."],
    ja: ["足を肩幅に開き、バーベルをフロントラックの位置（肩の前）で構えます。", "上体を立てたまま、膝を曲げて数センチ沈み込みます。", "脚で爆発的に床を押し、腕が伸びきるまでバーを頭上に押し上げます。", "バーを肩に戻し、構え直します。"],
  },
  Side_Bridge: {
    en: ["Lie on your side with your forearm under your shoulder and your legs straight.", "Lift your hips so your body forms a straight line from head to feet.", "Hold the position, then switch sides."],
    ja: ["横向きに寝て、肩の真下に前腕をつき、脚を伸ばします。", "頭から足まで一直線になるように腰を持ち上げます。", "姿勢を保持したら、反対側に替えます。"],
  },
  Side_Jackknife: {
    en: ["Lie on your side with your legs straight and your top hand behind your head.", "Lift your top leg and your torso at the same time, bringing them toward each other.", "Lower with control and repeat, then switch sides."],
    ja: ["横向きに寝て脚を伸ばし、上の手を頭の後ろに添えます。", "上の脚と上体を同時に持ち上げ、お互いに近づけます。", "コントロールして戻し、繰り返したら反対側に替えます。"],
  },
};
