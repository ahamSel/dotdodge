using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ButtonSound : MonoBehaviour
{
    public AudioSource buttonS;
    public AudioClip hoverS;
    public AudioClip clickS;

    public void OnHover()
    {
        buttonS.PlayOneShot(hoverS);
    }
    public void OnClick()
    {
        buttonS.PlayOneShot(clickS);
    }
}
