using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class Timer : MonoBehaviour
{
    public Text timer;
    public Text lvlText;
    public GameObject sloMo;
    public GameObject xForSloMo;

    public PlayerControls player;

    public GameObject warn1, warn2, warn3, warn4, warn5, warn6;
    public GameObject shooter, shooter1;

    public HomingMissile missileMovement, missile1Movement, missile2Movement, missile3Movement, missile4Movement, missile5Movement, missile6Movement;

    public float howMuchTime;

    public PauseMenu pauseMenu;
    public ButtonsScript toNotRestartEtc;
    public GameObject toNotPauseByIcon;

    public GameObject toNextLvlUI;

    public Rigidbody2D rb2d, rb2dM, rb2dM1, rb2dM2, rb2dM3, rb2dM4, rb2dM5, rb2dM6;

    float currentSlowMoSecs = 0f;
    float maxSlowMoSecs = 5f;

    // Start is called before the first frame update
    void Start()
    {
        timer.text = howMuchTime.ToString();
    }

    // Update is called once per frame
    void Update()
    {
        if (howMuchTime >= 0f)
        {
            howMuchTime -= Time.deltaTime;
            timer.text = Mathf.Round(howMuchTime).ToString();
        }
        else
        {
            rb2d.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM1.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM2.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM3.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM4.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM5.constraints = RigidbodyConstraints2D.FreezeAll;
            rb2dM6.constraints = RigidbodyConstraints2D.FreezeAll;

            pauseMenu.enabled = false;
            toNotRestartEtc.enabled = false;

            Button forclick = toNotPauseByIcon.GetComponent<Button>();
            forclick.enabled = false;

            Time.timeScale = 1f;
            toNextLvlUI.SetActive(true);
        }

        if (howMuchTime < 103f)
        {
            warn1.SetActive(true);
            lvlText.text = "Stage 2";
        }
        
        if (howMuchTime < 83f)
        {
            warn2.SetActive(true);
            lvlText.text = "Stage 3";
        }

        if (howMuchTime < 63f)
        {
            warn3.SetActive(true);
            lvlText.text = "Stage 4";
        }

        if (howMuchTime < 40f)
        {
            warn4.SetActive(true);
            warn5.SetActive(true);
            lvlText.text = "Stage 5";
        }

        if (howMuchTime < 23f)
        {
            sloMo.SetActive(true);
            xForSloMo.SetActive(true);

            shooter.SetActive(true);
            shooter1.SetActive(true);
            warn6.SetActive(true);
            lvlText.text = "Stage 6";

            if (Input.GetKeyDown("x"))
            {
                if (Time.timeScale == 1f)
                {
                    Time.timeScale = 0.1f;
                    Time.fixedDeltaTime = Time.timeScale * 0.02f;
                }
                else
                {
                    Time.timeScale = 1f;
                    player.moveForce = 1400;
                }
            }

            if (Time.timeScale == 0.1f)
            {
                player.moveForce = 3000;
                currentSlowMoSecs += Time.deltaTime;
            }

            if (currentSlowMoSecs > maxSlowMoSecs)
            {
                currentSlowMoSecs = 0f;
                Time.timeScale = 1f;
                player.moveForce = 1400;
            }
        }
    }
}
